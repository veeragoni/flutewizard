import { engine, holdAt, noiseBuffer } from './engine';
import { midiToFreq } from '../music/theory';
import type { ModelTimbre } from './modelVoice';

/**
 * Sound recipe for one flute family member. The voice is a small physical-ish model:
 * a harmonic tone (two waveforms, crossfaded by register) plus breath noise filtered around
 * the pitch, a broadband air hiss, an attack "chiff", and delayed vibrato in pitch and level.
 */
export interface Timbre {
  harmonicsLow: number[];
  harmonicsHigh: number[];
  /** MIDI note where the purer upper-register tone takes over. */
  registerBreak: number;
  breath: number;
  breathQ: number;
  hiss: number;
  chiff: number;
  attack: number;
  release: number;
  /** Pitch scoop at the start of a note, in cents (negative = from below). */
  scoop: number;
  vibratoRate: number;
  vibratoCents: number;
  vibratoAmp: number;
  vibratoDelay: number;
  /** Low-pass cutoff in multiples of the note frequency at full breath. */
  brightness: number;
  glide: number;
  gain: number;
  /** Physical-model settings; when present the app uses the modelled voice. */
  model?: ModelTimbre;
  /** Recorded sample set (public/samples/<id>.json), used when "Recorded" sound is chosen. */
  sampleSet?: string;
  /** Vibrato (cents) added to recordings that were made without it. */
  sampleVibrato?: number;
  /** Id of the player's own recordings for this flute and key ("Record your own"). */
  customSet?: string;
}

export interface NoteOptions {
  /** 0..1 breath pressure; 0.7 is a normal tone. */
  breath?: number;
  legato?: boolean;
}

export class FluteVoice {
  private ctx: AudioContext;
  private freq: ConstantSourceNode;
  private bend: ConstantSourceNode;
  private oscLow: OscillatorNode;
  private oscHigh: OscillatorNode;
  private gLow: GainNode;
  private gHigh: GainNode;
  private tone: BiquadFilterNode;
  private cutoff: GainNode;
  private breathBp: BiquadFilterNode;
  private breathGain: GainNode;
  private hissGain: GainNode;
  private chiffGain: GainNode;
  private amp: GainNode;
  private trem: GainNode;
  private lfo: OscillatorNode;
  private vibPitch: GainNode;
  private vibAmp: GainNode;
  private out: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private soundingUntil = 0;
  private sounding = false;
  private lastMidi: number | null = null;
  timbre: Timbre;
  /** Extra vibrato held by the player (0..1), added on top of the automatic vibrato. */
  private manualVibrato = 0;

  constructor(timbre: Timbre, destination: AudioNode) {
    const ctx = (this.ctx = engine.ensure());
    this.timbre = timbre;
    const noise = noiseBuffer(ctx);

    this.freq = new ConstantSourceNode(ctx, { offset: 440 });
    this.bend = new ConstantSourceNode(ctx, { offset: 0 });
    this.oscLow = new OscillatorNode(ctx, { frequency: 0 });
    this.oscHigh = new OscillatorNode(ctx, { frequency: 0 });
    this.gLow = new GainNode(ctx, { gain: 1 });
    this.gHigh = new GainNode(ctx, { gain: 0 });
    this.tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 0, Q: 0.5 });
    this.cutoff = new GainNode(ctx, { gain: timbre.brightness });
    this.amp = new GainNode(ctx, { gain: 0 });
    this.trem = new GainNode(ctx, { gain: 1 });
    this.out = new GainNode(ctx, { gain: timbre.gain });

    const breathSrc = new AudioBufferSourceNode(ctx, { buffer: noise, loop: true });
    this.breathBp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 0, Q: timbre.breathQ });
    this.breathGain = new GainNode(ctx, { gain: timbre.breath });
    const hissSrc = new AudioBufferSourceNode(ctx, { buffer: noise, loop: true, loopStart: 0.7 });
    const hissHp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 2800, Q: 0.3 });
    const hissLp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 9000 });
    this.hissGain = new GainNode(ctx, { gain: timbre.hiss });
    const chiffBp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 0, Q: 1.5 });
    const chiffFreq = new GainNode(ctx, { gain: 3 });
    this.chiffGain = new GainNode(ctx, { gain: 0 });

    this.lfo = new OscillatorNode(ctx, { frequency: timbre.vibratoRate });
    this.vibPitch = new GainNode(ctx, { gain: 0 });
    this.vibAmp = new GainNode(ctx, { gain: 0 });

    // Pitch wiring: one frequency source drives both oscillators and the breath filters.
    this.freq.connect(this.oscLow.frequency);
    this.freq.connect(this.oscHigh.frequency);
    this.freq.connect(this.breathBp.frequency);
    this.freq.connect(chiffFreq).connect(chiffBp.frequency);
    this.freq.connect(this.cutoff).connect(this.tone.frequency);
    for (const d of [this.oscLow.detune, this.oscHigh.detune, this.breathBp.detune]) {
      this.bend.connect(d);
      this.vibPitch.connect(d);
    }
    this.lfo.connect(this.vibPitch);
    this.lfo.connect(this.vibAmp).connect(this.trem.gain);

    // Audio wiring.
    this.oscLow.connect(this.gLow).connect(this.tone);
    this.oscHigh.connect(this.gHigh).connect(this.tone);
    breathSrc.connect(this.breathBp).connect(this.breathGain).connect(this.tone);
    this.tone.connect(this.amp);
    hissSrc.connect(hissHp).connect(hissLp).connect(this.hissGain).connect(this.amp);
    breathSrc.connect(chiffBp).connect(this.chiffGain).connect(this.trem);
    this.amp.connect(this.trem).connect(this.out).connect(destination);

    this.setTimbre(timbre);
    this.sources = [this.freq, this.bend, this.oscLow, this.oscHigh, breathSrc, hissSrc, this.lfo];
    const t = ctx.currentTime;
    for (const s of this.sources) s.start(t);
  }

  setTimbre(t: Timbre) {
    this.timbre = t;
    const ctx = this.ctx;
    this.oscLow.setPeriodicWave(wave(ctx, t.harmonicsLow));
    this.oscHigh.setPeriodicWave(wave(ctx, t.harmonicsHigh));
    this.breathBp.Q.value = t.breathQ;
    this.lfo.frequency.setTargetAtTime(t.vibratoRate, ctx.currentTime, 0.05);
    this.out.gain.setTargetAtTime(t.gain, ctx.currentTime, 0.05);
  }

  get isSounding() {
    return this.sounding && this.ctx.currentTime < this.soundingUntil + 0.05;
  }

  noteOn(midi: number, when = this.ctx.currentTime, opts: NoteOptions = {}) {
    const t = this.timbre;
    const breath = opts.breath ?? 0.7;
    const f = midiToFreq(midi);
    const wasSounding = this.sounding && when <= this.soundingUntil + 0.02;
    const legato = (opts.legato ?? true) && wasSounding;
    const high = midi >= t.registerBreak;
    // Upper notes need more air: a touch more level and brightness.
    const regBoost = Math.min(1.25, 0.9 + (midi - 60) / 120);
    const level = (0.32 + 0.6 * breath) * regBoost;

    holdAt(this.freq.offset, when);
    holdAt(this.amp.gain, when);
    holdAt(this.cutoff.gain, when);
    holdAt(this.vibPitch.gain, when);
    holdAt(this.vibAmp.gain, when);
    holdAt(this.gLow.gain, when);
    holdAt(this.gHigh.gain, when);
    holdAt(this.breathGain.gain, when);

    const xf = legato ? t.glide : 0.005;
    this.gLow.gain.setTargetAtTime(high ? 0 : 1, when, xf);
    this.gHigh.gain.setTargetAtTime(high ? 1 : 0, when, xf);

    if (legato && this.lastMidi !== null) {
      this.freq.offset.setTargetAtTime(f, when, t.glide / 3);
      // A small dip in level as the fingers change, like a real slur.
      this.amp.gain.setTargetAtTime(level * 0.8, when, 0.01);
      this.amp.gain.setTargetAtTime(level, when + 0.03, 0.03);
      this.burst(when, t.chiff * 0.25);
    } else {
      this.freq.offset.setValueAtTime(f * Math.pow(2, t.scoop / 1200), when);
      this.freq.offset.setTargetAtTime(f, when, 0.025);
      if (wasSounding) {
        // Tongued re-attack: a quick dip instead of a hard cut avoids a click.
        this.amp.gain.linearRampToValueAtTime(level * 0.12, when + 0.012);
      } else {
        this.amp.gain.setValueAtTime(0.0001, when);
      }
      this.amp.gain.linearRampToValueAtTime(level * 1.12, when + t.attack * 0.6);
      this.amp.gain.setTargetAtTime(level, when + t.attack * 0.6, t.attack);
      this.burst(when, t.chiff);
    }
    // Breath noise is strongest at the start of the note and settles as the tone speaks.
    this.breathGain.gain.setValueAtTime(t.breath * (legato ? 1.1 : 1.8), when);
    this.breathGain.gain.setTargetAtTime(t.breath * (0.7 + 0.6 * (1 - breath)), when + 0.02, 0.12);
    this.cutoff.gain.setTargetAtTime(t.brightness * (0.55 + 0.8 * breath) * (high ? 1.1 : 1), when, 0.05);

    // Vibrato blooms in after a moment, as players do on held notes.
    const vd = legato ? t.vibratoDelay * 0.6 : t.vibratoDelay;
    const depth = t.vibratoCents * (1 + this.manualVibrato * 2);
    this.vibPitch.gain.setValueAtTime(0, when);
    this.vibAmp.gain.setValueAtTime(0, when);
    this.vibPitch.gain.setTargetAtTime(depth, when + vd, 0.25);
    this.vibAmp.gain.setTargetAtTime(t.vibratoAmp * (1 + this.manualVibrato), when + vd, 0.25);

    this.sounding = true;
    this.soundingUntil = Infinity;
    this.lastMidi = midi;
  }

  noteOff(when = this.ctx.currentTime) {
    const t = this.timbre;
    holdAt(this.amp.gain, when);
    this.amp.gain.setTargetAtTime(0, when, t.release / 3);
    holdAt(this.vibPitch.gain, when);
    this.vibPitch.gain.setTargetAtTime(0, when, 0.1);
    this.soundingUntil = when;
    this.sounding = false;
    this.lastMidi = null;
  }

  /** Schedules a whole note: on at `when` for `dur` seconds. Notes that touch are slurred. */
  play(midi: number, when: number, dur: number, opts: NoteOptions = {}) {
    const legato = opts.legato ?? false;
    this.noteOn(midi, when, { ...opts, legato });
    this.sounding = true;
    this.soundingUntil = when + dur;
    holdAt(this.amp.gain, when + dur);
    this.amp.gain.setTargetAtTime(0, when + dur, this.timbre.release / 3);
    holdAt(this.vibPitch.gain, when + dur);
    this.vibPitch.gain.setTargetAtTime(0, when + dur, 0.1);
  }

  /** Bend in cents (bansuri meend, whistle slides). */
  setBend(cents: number, glideTime = 0.06) {
    this.bend.offset.setTargetAtTime(cents, this.ctx.currentTime, glideTime / 3);
  }

  setVibrato(amount: number) {
    this.manualVibrato = amount;
    if (!this.sounding) return;
    const now = this.ctx.currentTime;
    const t = this.timbre;
    holdAt(this.vibPitch.gain, now);
    holdAt(this.vibAmp.gain, now);
    this.vibPitch.gain.setTargetAtTime(t.vibratoCents * (1 + amount * 2), now, 0.08);
    this.vibAmp.gain.setTargetAtTime(t.vibratoAmp * (1 + amount), now, 0.08);
  }

  /** Live breath pressure from the breath control or a microphone. */
  setBreath(breath: number) {
    if (!this.sounding || this.lastMidi === null) return;
    const now = this.ctx.currentTime;
    const regBoost = Math.min(1.25, 0.9 + (this.lastMidi - 60) / 120);
    holdAt(this.amp.gain, now);
    this.amp.gain.setTargetAtTime((0.32 + 0.6 * breath) * regBoost, now, 0.04);
    holdAt(this.cutoff.gain, now);
    this.cutoff.gain.setTargetAtTime(this.timbre.brightness * (0.55 + 0.8 * breath), now, 0.05);
  }

  /** Silence immediately and cancel anything scheduled. */
  stop() {
    const now = this.ctx.currentTime;
    for (const p of [this.amp.gain, this.chiffGain.gain, this.vibPitch.gain, this.vibAmp.gain]) {
      p.cancelScheduledValues(now);
      p.setTargetAtTime(0, now, 0.02);
    }
    this.sounding = false;
    this.soundingUntil = 0;
    this.lastMidi = null;
  }

  dispose() {
    this.stop();
    const end = this.ctx.currentTime + 0.3;
    for (const s of this.sources) s.stop(end);
    setTimeout(() => this.out.disconnect(), 400);
  }

  private burst(when: number, amount: number) {
    if (amount <= 0) return;
    const g = this.chiffGain.gain;
    holdAt(g, when);
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(amount, when + 0.006);
    g.setTargetAtTime(0, when + 0.012, 0.02);
  }
}

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function wave(ctx: BaseAudioContext, harmonics: number[]): PeriodicWave {
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = new Map()));
  const key = harmonics.join(',');
  let w = m.get(key);
  if (!w) {
    const real = new Float32Array(harmonics.length + 1);
    const imag = new Float32Array(harmonics.length + 1);
    harmonics.forEach((a, i) => (imag[i + 1] = a));
    w = ctx.createPeriodicWave(real, imag);
    m.set(key, w);
  }
  return w;
}
