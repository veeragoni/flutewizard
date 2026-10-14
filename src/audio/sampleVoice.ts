import { engine, holdAt } from './engine';
import type { NoteOptions, Timbre } from './voice';
import type { Voice } from './modelVoice';
import { yin } from './pitch';

/**
 * Plays real recorded notes. A sample set is a few notes recorded on the actual instrument;
 * the nearest one is pitch-shifted for each note. Held notes sustain with a seamless loop
 * found automatically in the steady part of each recording, so samples can be any length.
 */

export interface SampleSetManifest {
  id: string;
  /** Attribution shown on the credits page. */
  credit: string;
  license: string;
  /** `cents`: how sharp the recording is (measured), corrected on playback. */
  notes: { midi: number; url: string; gain?: number; cents?: number }[];
}

interface LoadedSample {
  midi: number;
  buffer: AudioBuffer;
  /** Seconds. Attack portion plays once, then loop region repeats. */
  loopStart: number;
  loopEnd: number;
  gain: number;
  cents: number;
  /** Seconds of silence/encoder padding to skip at the start. */
  offset: number;
}

const cache = new Map<string, Promise<LoadedSample[]>>();

export function loadSampleSet(m: SampleSetManifest, base = ''): Promise<LoadedSample[]> {
  let p = cache.get(m.id);
  if (!p) {
    const ctx = engine.ensure();
    p = Promise.all(m.notes.map(async (n) => {
      const res = await fetch(base + n.url);
      if (!res.ok) throw new Error(`Could not load ${n.url}`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const prepared = prepareLoop(ctx, buf, n.midi);
      return { midi: n.midi, gain: n.gain ?? 1, cents: n.cents ?? 0, offset: leadingSilence(buf), ...prepared };
    }));
    cache.set(m.id, p);
  }
  return p;
}

/** Builds a sample set from recordings kept in the browser (no caching: they change). */
export async function loadSamplesFromBlobs(notes: { midi: number; wav: Blob; cents: number }[]): Promise<LoadedSample[]> {
  const ctx = engine.ensure();
  return Promise.all(notes.map(async (n) => {
    const buf = await ctx.decodeAudioData(await n.wav.arrayBuffer());
    return { midi: n.midi, gain: 1, cents: n.cents, offset: leadingSilence(buf), ...prepareLoop(ctx, buf, n.midi) };
  }));
}

/** Start of the sound (skips MP3 encoder padding and pre-roll), a couple of ms early. */
function leadingSilence(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const thr = peak * 0.02;
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > thr) return Math.max(0, i / buf.sampleRate - 0.003);
  return 0;
}

/**
 * Finds a loop of whole periods in the steady middle of the note and bakes a crossfade into the
 * buffer at the seam, so looping is click-free.
 */
export function prepareLoop(ctx: BaseAudioContext, buf: AudioBuffer, midi: number): { buffer: AudioBuffer; loopStart: number; loopEnd: number } {
  const sr = buf.sampleRate;
  const data = buf.getChannelData(0);
  const len = data.length;
  // Measure the actual pitch (recordings are rarely exactly on the note).
  const mid = Math.floor(len * 0.45);
  const est = yin(data.subarray(mid, Math.min(len, mid + 4096)), sr, 80, 4000);
  const freq = est.freq ?? 440 * Math.pow(2, (midi - 69) / 12);
  const period = sr / freq;
  // Steady region: skip the attack (first 25%) and the decay (last 20%).
  const a = Math.floor(len * 0.25), b = Math.floor(len * 0.8);
  if (b - a < period * 8) return { buffer: buf, loopStart: 0, loopEnd: 0 };
  const targetLen = Math.min(b - a - period * 2, sr * 0.8);
  const cycles = Math.max(4, Math.round(targetLen / period));
  const loopLen = Math.round(cycles * period);
  // Best start: where the waveform matches itself one loop later.
  let bestStart = a, bestErr = Infinity;
  const win = Math.min(256, Math.floor(period * 2));
  for (let s = a; s + loopLen + win < b; s += Math.max(1, Math.floor(period / 8))) {
    let err = 0;
    for (let k = 0; k < win; k++) {
      const d = data[s + k] - data[s + loopLen + k];
      err += d * d;
    }
    if (err < bestErr) { bestErr = err; bestStart = s; }
  }
  const start = bestStart, end = bestStart + loopLen;
  // Bake a crossfade: the last `fade` samples of the loop blend into the samples just before the start.
  const fade = Math.min(Math.floor(loopLen / 3), Math.floor(sr * 0.08));
  const out = ctx.createBuffer(buf.numberOfChannels, end, sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, end));
    for (let k = 0; k < fade; k++) {
      const t = k / fade;
      const i = end - fade + k;
      const j = start - fade + k;
      if (j >= 0) dst[i] = src[i] * (1 - t) + src[j] * t;
    }
  }
  return { buffer: out, loopStart: start / sr, loopEnd: end / sr };
}

export class SampleVoice implements Voice {
  private ctx: AudioContext;
  private samples: LoadedSample[];
  private out: GainNode;
  private lfo: OscillatorNode;
  private vibDepth: GainNode;
  private current: { src: AudioBufferSourceNode; gain: GainNode; sample: LoadedSample } | null = null;
  private sounding = false;
  private soundingUntil = 0;
  private bend = 0;
  timbre: Timbre;
  readonly setId: string;

  constructor(setId: string, samples: LoadedSample[], timbre: Timbre, dest: AudioNode) {
    this.setId = setId;
    this.ctx = engine.ensure();
    this.samples = [...samples].sort((x, y) => x.midi - y.midi);
    this.timbre = timbre;
    // Recordings are levelled to −18 dB RMS; bring them up to match the modelled voice.
    this.out = new GainNode(this.ctx, { gain: 3.2 });
    this.out.connect(dest);
    this.lfo = new OscillatorNode(this.ctx, { frequency: timbre.model?.vibratoRate ?? 5 });
    this.vibDepth = new GainNode(this.ctx, { gain: 0 });
    this.lfo.connect(this.vibDepth);
    this.lfo.start();
  }

  private nearest(midi: number): LoadedSample {
    let best = this.samples[0];
    for (const s of this.samples) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    return best;
  }

  setTimbre(t: Timbre) { this.timbre = t; }
  get isSounding() { return this.sounding && this.ctx.currentTime < this.soundingUntil + 0.05; }

  noteOn(midi: number, when = this.ctx.currentTime, opts: NoteOptions = {}) {
    const m = this.timbre.model;
    const s = this.nearest(midi);
    const detune = (midi - s.midi) * 100 - s.cents + this.bend;
    const wasSounding = this.sounding && when <= this.soundingUntil + 0.02;
    const legato = (opts.legato ?? true) && wasSounding && this.current;
    const level = (0.55 + 0.6 * (opts.breath ?? 0.7)) * s.gain;

    if (legato && this.current && this.current.sample === s) {
      // Same recording: glide its pitch (a slur).
      holdAt(this.current.src.detune, when);
      this.current.src.detune.setTargetAtTime(detune, when, (m?.glide ?? 0.04) / 3);
    } else {
      const src = new AudioBufferSourceNode(this.ctx, { buffer: s.buffer, detune });
      if (s.loopEnd > s.loopStart) {
        src.loop = true;
        src.loopStart = s.loopStart;
        src.loopEnd = s.loopEnd;
      }
      this.vibDepth.connect(src.detune);
      const g = new GainNode(this.ctx, { gain: 0 });
      src.connect(g).connect(this.out);
      // Legato: skip the new note's attack and crossfade; otherwise play the recorded attack.
      const offset = legato ? Math.max(s.offset, s.loopStart - 0.02) : s.offset;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(level, when + (legato ? 0.05 : 0.008));
      src.start(when, offset);
      if (this.current) this.release(this.current, when, legato ? 0.05 : 0.03);
      this.current = { src, gain: g, sample: s };
    }
    // Delayed vibrato.
    holdAt(this.vibDepth.gain, when);
    this.vibDepth.gain.setValueAtTime(0, when);
    this.vibDepth.gain.setTargetAtTime(this.timbre.sampleVibrato ?? 0, when + (m?.vibratoDelay ?? 0.4), 0.3);
    this.sounding = true;
    this.soundingUntil = Infinity;
  }

  private release(c: NonNullable<SampleVoice['current']>, when: number, time: number) {
    holdAt(c.gain.gain, when);
    c.gain.gain.setTargetAtTime(0, when, time / 3);
    c.src.stop(when + time * 3 + 0.05);
  }

  noteOff(when = this.ctx.currentTime) {
    if (this.current) this.release(this.current, when, this.timbre.model?.release ?? 0.12);
    this.current = null;
    this.sounding = false;
    this.soundingUntil = when;
  }

  play(midi: number, when: number, dur: number, opts: NoteOptions = {}) {
    this.noteOn(midi, when, { ...opts, legato: opts.legato ?? false });
    const c = this.current!;
    this.soundingUntil = when + dur;
    this.release(c, when + dur, this.timbre.model?.release ?? 0.12);
    this.current = c; // still the current note until the next one starts
  }

  setBend(cents: number, glideTime = 0.06) {
    const delta = cents - this.bend;
    this.bend = cents;
    if (this.current) {
      const d = this.current.src.detune;
      holdAt(d, this.ctx.currentTime);
      d.setTargetAtTime(d.value + delta, this.ctx.currentTime, glideTime / 3);
    }
  }

  setVibrato(amount: number) {
    holdAt(this.vibDepth.gain, this.ctx.currentTime);
    this.vibDepth.gain.setTargetAtTime((this.timbre.sampleVibrato ?? 0) + amount * 14, this.ctx.currentTime, 0.08);
  }

  setBreath(breath: number) {
    if (!this.current) return;
    holdAt(this.current.gain.gain, this.ctx.currentTime);
    this.current.gain.gain.setTargetAtTime((0.55 + 0.6 * breath) * this.current.sample.gain, this.ctx.currentTime, 0.05);
  }

  stop() {
    if (this.current) this.release(this.current, this.ctx.currentTime, 0.03);
    this.current = null;
    this.sounding = false;
  }

  dispose() {
    this.stop();
    this.lfo.stop(this.ctx.currentTime + 0.2);
  }
}
