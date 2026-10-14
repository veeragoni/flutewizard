import { signal } from '@preact/signals';
import { engine } from './engine';
import type { Timbre } from './voice';
import { HybridVoice, type Voice } from './modelVoice';
import { GROOVES, harmonize, playBass, playClick, playDrum, playPad, type Chord, type Groove } from './backing';
import { barLength, songLength, type Song, type SongNote } from '../music/song';
import { midiToFreq } from '../music/theory';

/**
 * Plays a song in time: the guide melody, the backing band and the metronome, scheduled a little
 * ahead on the audio clock. In "wait" mode it stops at each note until the player plays it.
 */

export type PlayMode = 'listen' | 'along' | 'wait';

export interface BandSettings {
  drums: boolean;
  groove: string; // groove id, or 'auto'
  bass: boolean;
  pad: boolean;
  click: boolean;
  countIn: boolean;
}

export const DEFAULT_BAND: BandSettings = { drums: true, groove: 'auto', bass: true, pad: true, click: false, countIn: true };

export const transportState = {
  playing: signal(false),
  waiting: signal(false),
  /** Current position in beats (negative during the count-in). */
  beat: signal(0),
  /** Index of the melody note at the playhead, or -1. */
  noteIndex: signal(-1),
  hits: signal(0),
  misses: signal(0),
};

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

class Transport {
  song: Song | null = null;
  chords: Chord[] = [];
  bpm = 90;
  mode: PlayMode = 'along';
  band: BandSettings = { ...DEFAULT_BAND };
  bandOn = true;
  guide = true;
  /** In wait mode, accept the right note in any octave. */
  anyOctave = false;
  loop: [number, number] | null = null;
  /** Tabla tuning follows Sa. */
  tablaHz = 261.6;

  private voice: Voice | null = null;
  private timer: number | null = null;
  private raf = 0;
  private anchorTime = 0;
  private anchorBeat = 0;
  private scheduledTo = 0; // beats
  private waitAt: number | null = null; // beat the transport is holding at
  private satisfied = new Set<number>();
  private judged = new Set<number>();
  private userNotes: { midi: number; time: number }[] = [];
  private endBeat = 0;

  setSong(song: Song | null) {
    this.stop();
    this.song = song;
    this.chords = song ? harmonize(song) : [];
    if (song) this.bpm = song.bpm;
    transportState.beat.value = 0;
    transportState.noteIndex.value = -1;
  }

  setTimbre(t: Timbre) {
    if (this.voice) this.voice.setTimbre(t);
  }

  ensureVoice(t: Timbre) {
    if (!this.voice) this.voice = new HybridVoice(t, engine.guide.input);
    else this.voice.setTimbre(t);
  }

  setTempo(bpm: number) {
    if (transportState.playing.value && this.waitAt === null) {
      const b = this.beatAt(engine.now);
      this.anchorBeat = b;
      this.anchorTime = engine.now;
      this.prevAnchor = null;
    }
    this.bpm = bpm;
  }

  get secPerBeat() {
    return 60 / this.bpm;
  }

  /** The previous pass's clock, used for the moment between scheduling a loop wrap and reaching it. */
  private prevAnchor: { beat: number; time: number } | null = null;

  private beatAt(time: number): number {
    if (this.waitAt !== null) return this.waitAt;
    if (this.prevAnchor && time < this.anchorTime) {
      return this.prevAnchor.beat + (time - this.prevAnchor.time) / this.secPerBeat;
    }
    return this.anchorBeat + (time - this.anchorTime) / this.secPerBeat;
  }

  private timeAt(beat: number): number {
    return this.anchorTime + (beat - this.anchorBeat) * this.secPerBeat;
  }

  play(fromBeat?: number) {
    if (!this.song) return;
    engine.ensure();
    this.stop(false);
    const song = this.song;
    this.endBeat = this.loop ? this.loop[1] : songLength(song);
    let start = fromBeat ?? transportState.beat.value;
    if (start >= this.endBeat - 0.01 || start < 0) start = this.loop ? this.loop[0] : 0;
    const bar = barLength(song.time);
    const countIn = this.band.countIn && this.mode !== 'listen' ? bar : 0;
    this.anchorBeat = start - countIn;
    this.anchorTime = engine.now + 0.08;
    this.scheduledTo = this.anchorBeat;
    this.waitAt = null;
    this.prevAnchor = null;
    this.satisfied.clear();
    this.judged.clear();
    this.userNotes = [];
    transportState.hits.value = 0;
    transportState.misses.value = 0;
    transportState.playing.value = true;
    transportState.waiting.value = false;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
    const loop = () => {
      this.updatePosition();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (!transportState.playing.value) return;
    const b = this.beatAt(engine.now);
    this.stop(false);
    transportState.beat.value = Math.max(0, b);
  }

  stop(reset = true) {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    this.voice?.stop();
    transportState.playing.value = false;
    transportState.waiting.value = false;
    this.waitAt = null;
    if (reset) {
      transportState.beat.value = this.loop ? this.loop[0] : 0;
      transportState.noteIndex.value = -1;
    }
  }

  seek(beat: number) {
    const playing = transportState.playing.value;
    this.stop(false);
    transportState.beat.value = Math.max(0, beat);
    transportState.noteIndex.value = this.noteIndexAt(beat);
    if (playing) this.play(beat);
  }

  /** Called with every note the player starts (keyboard, fingers or microphone). */
  userNote(midi: number) {
    if (!this.song || !transportState.playing.value) return;
    const now = engine.now;
    this.userNotes.push({ midi, time: now });
    if (this.userNotes.length > 64) this.userNotes.shift();
    if (this.mode === 'wait' && this.waitAt !== null) {
      const idx = this.nextNoteIndex(this.waitAt - 1e-6);
      const n = idx >= 0 ? this.song.notes[idx] : null;
      if (n && n.midi !== null && this.matches(midi, n.midi)) {
        this.satisfied.add(idx);
        this.judge(idx, true);
        // Resume from the note we were holding at.
        this.anchorBeat = this.waitAt;
        this.anchorTime = now;
        this.scheduledTo = this.waitAt;
        this.waitAt = null;
        transportState.waiting.value = false;
      }
    } else if (this.mode === 'along') {
      const b = this.beatAt(now);
      const idx = this.noteIndexAt(b + 0.25);
      const n = idx >= 0 ? this.song.notes[idx] : null;
      if (n && n.midi !== null && !this.judged.has(idx) && this.matches(midi, n.midi)) this.judge(idx, true);
    }
  }

  private matches(played: number, want: number) {
    return this.anyOctave ? (played - want) % 12 === 0 : played === want;
  }

  private judge(idx: number, hit: boolean) {
    if (this.judged.has(idx)) return;
    this.judged.add(idx);
    if (hit) transportState.hits.value++;
    else transportState.misses.value++;
  }

  private noteIndexAt(beat: number): number {
    const notes = this.song?.notes ?? [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.midi !== null && beat >= n.start - 1e-6 && beat < n.start + n.dur) return i;
    }
    return -1;
  }

  private nextNoteIndex(beat: number): number {
    const notes = this.song?.notes ?? [];
    for (let i = 0; i < notes.length; i++) if (notes[i].midi !== null && notes[i].start > beat - 1e-6) return i;
    return -1;
  }

  private updatePosition() {
    const b = this.beatAt(engine.now);
    transportState.beat.value = b;
    const idx = this.noteIndexAt(b);
    if (idx !== transportState.noteIndex.value) {
      // Judge the note that just finished in play-along mode.
      const prev = transportState.noteIndex.value;
      if (this.mode === 'along' && prev >= 0 && !this.judged.has(prev)) this.judge(prev, false);
      transportState.noteIndex.value = idx;
    }
  }

  private tick() {
    const song = this.song;
    if (!song) return;
    const now = engine.now;
    if (this.waitAt !== null) return;

    // Wait mode: hold at the next unsatisfied note once its start time arrives.
    if (this.mode === 'wait') {
      const b = this.beatAt(now);
      const idx = this.nextNoteIndex(Math.max(0, b - 0.05));
      if (idx >= 0) {
        const n = song.notes[idx];
        if (!this.satisfied.has(idx) && b >= n.start - 0.02 && b >= 0) {
          this.waitAt = n.start;
          transportState.waiting.value = true;
          this.scheduledTo = n.start;
          return;
        }
      }
    }

    const horizonBeat = this.beatAt(now + LOOKAHEAD);
    let limit = horizonBeat;
    if (this.mode === 'wait') {
      const idx = this.nextNoteIndex(this.scheduledTo);
      if (idx >= 0 && !this.satisfied.has(idx)) {
        const n = song.notes[idx];
        // Schedule up to (and including) the waiting note's downbeat only.
        limit = Math.min(limit, n.start + 1e-3);
      }
    }
    if (limit <= this.scheduledTo) {
      this.maybeFinish(now);
      return;
    }
    if (limit >= this.endBeat && this.scheduledTo < this.endBeat) {
      this.schedule(this.scheduledTo, this.endBeat);
      this.scheduledTo = this.endBeat;
      if (this.looping) {
        // Wrap ahead of time so the first notes of the next pass are scheduled on time.
        const endTime = this.timeAt(this.endBeat);
        this.prevAnchor = { beat: this.anchorBeat, time: this.anchorTime };
        this.anchorBeat = this.loop ? this.loop[0] : 0;
        this.anchorTime = endTime;
        this.scheduledTo = this.anchorBeat;
        this.satisfied.clear();
        this.judged.clear();
      }
      return;
    }
    if (this.scheduledTo < this.endBeat) {
      this.schedule(this.scheduledTo, Math.min(limit, this.endBeat));
      this.scheduledTo = limit;
    }
    this.maybeFinish(now);
  }

  private get looping() {
    return !!this.loop || this.loopWhole;
  }

  private maybeFinish(now: number) {
    if (!this.looping && this.scheduledTo >= this.endBeat && this.beatAt(now) >= this.endBeat + 0.25) this.stop();
  }

  /** Repeat the whole song when there is no loop range. */
  loopWhole = false;

  private schedule(from: number, to: number) {
    const song = this.song!;
    const spb = this.secPerBeat;
    const bar = barLength(song.time);
    const out = engine.backing.input;

    // Guide melody.
    if (this.voice && (this.guide || this.mode === 'listen')) {
      song.notes.forEach((n: SongNote, i) => {
        if (n.midi === null || n.start < from - 1e-6 || n.start >= to - 1e-6) return;
        const when = this.timeAt(n.start);
        if (when < engine.now - 0.01) return;
        const next = song.notes[i + 1];
        const slur = next && next.midi !== null && Math.abs(next.start - (n.start + n.dur)) < 1e-3 && next.midi !== n.midi;
        // Articulate: leave a small gap unless the next note follows a step away (slur).
        const gap = slur ? 0 : Math.min(0.06, n.dur * spb * 0.12);
        this.voice!.play(n.midi, when, Math.max(0.05, n.dur * spb - gap), { breath: 0.68, legato: false });
      });
    }

    // Count-in clicks and metronome.
    const firstBeat = Math.ceil(from - 1e-6);
    for (let b = firstBeat; b < to - 1e-6; b++) {
      const when = this.timeAt(b);
      if (when < engine.now - 0.01) continue;
      const inCountIn = b < 0;
      if ((inCountIn || this.band.click) && song.click !== false) {
        const beatInBar = (((b % bar) + bar) % bar);
        playClick(when, beatInBar < 1e-6, engine.click.input);
      }
    }

    if (!this.bandOn) return;
    // Drums.
    if (this.band.drums) {
      const groove = this.grooveFor(song);
      if (groove) {
        const step = 1 / groove.stepsPerBeat;
        const firstStep = Math.ceil(Math.max(0, from) / step - 1e-6);
        for (let s = firstStep; s * step < to - 1e-6; s++) {
          const beat = s * step;
          const pos = s % groove.length;
          for (const [hs, sound, vel] of groove.hits) {
            if (hs !== pos) continue;
            const when = this.timeAt(beat);
            if (when >= engine.now - 0.01) playDrum(sound, when, vel, out, this.tablaHz);
          }
        }
      }
    }
    // Bass and pad follow the auto chords.
    for (const c of this.chords) {
      if (c.start < from - 1e-6 || c.start >= to - 1e-6) continue;
      const when = this.timeAt(c.start);
      if (when < engine.now - 0.01) continue;
      const dur = c.dur * spb;
      if (this.band.pad) playPad(c, when, dur, out);
      if (this.band.bass) {
        const root = 36 + ((c.root - 0 + 12) % 12);
        const half = c.dur / 2;
        if (c.dur >= 2 && song.time[0] % 3 !== 0) {
          playBass(root, when, half * spb * 0.95, out);
          playBass(root + 7, this.timeAt(c.start + half), half * spb * 0.95, out);
        } else {
          playBass(root, when, dur * 0.95, out);
        }
      }
    }
  }

  private grooveFor(song: Song): Groove | null {
    const id = this.band.groove === 'auto' ? song.groove ?? 'auto' : this.band.groove;
    if (id === 'none') return null;
    if (id !== 'auto') return GROOVES.find((g) => g.id === id) ?? null;
    const sig = `${song.time[0]}/${song.time[1]}`;
    return GROOVES.find((g) => g.fits.includes(sig)) ?? null;
  }

  /** Plays one note on the guide voice (preview / hint). */
  preview(midi: number, seconds = 0.7) {
    if (!this.voice) return;
    this.voice.play(midi, engine.now + 0.02, seconds);
  }
}

export const transport = new Transport();

export function tablaHzForSa(sa: number): number {
  let f = midiToFreq(sa);
  while (f < 220) f *= 2;
  while (f > 440) f /= 2;
  return f;
}
