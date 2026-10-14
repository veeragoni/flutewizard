import { engine, holdAt } from './engine';
import { FluteVoice, type NoteOptions, type Timbre } from './voice';
import { loadSampleSet, loadSamplesFromBlobs, SampleVoice, type SampleSetManifest } from './sampleVoice';
import { customNotes, customVersion } from './customSamples';
import { midiToFreq } from '../music/theory';
// Loaded as raw text and run from a Blob, so the dev server can't inject HMR code into the worklet.
import workletSource from './worklets/flute-worklet.js?raw';

/**
 * Flute voice driven by the physical model (see worklets/flute-worklet.js). Breath pressure is
 * what we automate: the tone builds, chiffs, tongues and dies away the way a real air column does.
 * Until the worklet has loaded (a few ms after the first click) it falls back to the simple synth.
 */

export interface BodyBand {
  type: BiquadFilterType;
  freq: number;
  q?: number;
  gain?: number;
}

export interface ModelTimbre {
  noise: number;
  airMix: number;
  brightness: number;
  vibratoRate: number;
  vibratoDepth: number;
  vibratoDelay: number;
  attack: number;
  release: number;
  /** Extra turbulence burst at the start of each note (fipple chiff, tonguing). */
  chiff: number;
  /** Pressure dip for a tongued re-attack (0 = none, 1 = full stop). */
  tongue: number;
  glide: number;
  body: BodyBand[];
  gain: number;
}

export interface Voice {
  setTimbre(t: Timbre): void;
  readonly isSounding: boolean;
  noteOn(midi: number, when?: number, opts?: NoteOptions): void;
  noteOff(when?: number): void;
  play(midi: number, when: number, dur: number, opts?: NoteOptions): void;
  setBend(cents: number, glideTime?: number): void;
  setVibrato(amount: number): void;
  setBreath(breath: number): void;
  stop(): void;
  dispose(): void;
}

let moduleReady: Promise<void> | null = null;
let moduleLoaded = false;

export function loadFluteModel(): Promise<void> {
  if (!moduleReady) {
    const ctx = engine.ensure();
    const url = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }));
    moduleReady = ctx.audioWorklet.addModule(url).then(() => {
      moduleLoaded = true;
    });
    moduleReady.catch((e) => console.warn('[flute] physical model unavailable, using simple synth', e));
  }
  return moduleReady;
}

/** Breath (0..1) to model pressure: inside the window where the tube speaks reliably. */
const P_LO = 0.9, P_HI = 1.02;
const pressureFor = (breath: number) => P_LO + (P_HI - P_LO) * Math.max(0, Math.min(1, breath));

class ModelVoiceImpl implements Voice {
  private ctx: AudioContext;
  private node: AudioWorkletNode;
  private out: GainNode;
  private filters: BiquadFilterNode[] = [];
  private dest: AudioNode;
  timbre: Timbre;
  private m: ModelTimbre;
  private sounding = false;
  private soundingUntil = 0;
  private breath = 0.7;
  private manualVibrato = 0;

  constructor(timbre: Timbre, dest: AudioNode) {
    this.ctx = engine.ensure();
    this.timbre = timbre;
    this.m = timbre.model!;
    this.dest = dest;
    this.node = new AudioWorkletNode(this.ctx, 'flute-model', { numberOfInputs: 0, outputChannelCount: [1] });
    this.out = new GainNode(this.ctx, { gain: this.m.gain });
    this.wire();
    this.setTimbre(timbre);
  }

  private p(name: string): AudioParam {
    return this.node.parameters.get(name)!;
  }

  private wire() {
    this.node.disconnect();
    for (const f of this.filters) f.disconnect();
    this.filters = this.m.body.map((b) => new BiquadFilterNode(this.ctx, { type: b.type, frequency: b.freq, Q: b.q ?? 0.7, gain: b.gain ?? 0 }));
    let last: AudioNode = this.node;
    for (const f of this.filters) {
      last.connect(f);
      last = f;
    }
    last.connect(this.out).connect(this.dest);
  }

  setTimbre(t: Timbre) {
    const bodyChanged = JSON.stringify(t.model!.body) !== JSON.stringify(this.m.body);
    this.timbre = t;
    this.m = t.model!;
    const now = this.ctx.currentTime;
    this.p('noise').setValueAtTime(this.m.noise, now);
    this.p('airMix').setValueAtTime(this.m.airMix, now);
    this.p('brightness').setValueAtTime(this.m.brightness, now);
    this.p('vibratoRate').setValueAtTime(this.m.vibratoRate, now);
    this.out.gain.setTargetAtTime(this.m.gain, now, 0.05);
    if (bodyChanged) this.wire();
  }

  get isSounding() {
    return this.sounding && this.ctx.currentTime < this.soundingUntil + 0.05;
  }

  noteOn(midi: number, when = this.ctx.currentTime, opts: NoteOptions = {}) {
    const m = this.m;
    const breath = opts.breath ?? this.breath;
    this.breath = breath;
    const f = midiToFreq(midi);
    const wasSounding = this.sounding && when <= this.soundingUntil + 0.02;
    const legato = (opts.legato ?? true) && wasSounding;
    const press = this.p('pressure');
    const freq = this.p('frequency');
    const air = this.p('airMix');
    const vib = this.p('vibratoDepth');

    holdAt(press, when);
    holdAt(freq, when);
    holdAt(vib, when);
    if (legato) {
      // Slur: fingers move, air keeps flowing. The tube glides to the new length.
      freq.setTargetAtTime(f, when, m.glide / 3);
      press.setTargetAtTime(pressureFor(breath), when, 0.02);
    } else {
      freq.setValueAtTime(f, when);
      if (wasSounding && m.tongue > 0) {
        // Tongued: a brief "t" that interrupts the air.
        press.linearRampToValueAtTime(pressureFor(breath) * (1 - 0.35 * m.tongue), when + 0.012);
        press.linearRampToValueAtTime(pressureFor(breath) * 1.03, when + 0.035);
      } else {
        press.setValueAtTime(0, when);
        // Air builds slightly past the target, then settles: the "push" of a real attack.
        press.linearRampToValueAtTime(pressureFor(breath) * 1.04, when + m.attack);
      }
      press.setTargetAtTime(pressureFor(breath), when + m.attack, m.attack);
      // Turbulence burst at the start (chiff).
      if (m.chiff > 0) {
        holdAt(air, when);
        air.setValueAtTime(m.airMix + m.chiff, when);
        air.setTargetAtTime(m.airMix, when + 0.01, 0.04);
      }
    }
    // Vibrato blooms in on held notes.
    const depth = m.vibratoDepth * (1 + this.manualVibrato * 1.5);
    vib.setValueAtTime(legato ? vib.value * 0.5 : 0, when);
    vib.setTargetAtTime(depth, when + (legato ? m.vibratoDelay * 0.5 : m.vibratoDelay), 0.3);

    this.sounding = true;
    this.soundingUntil = Infinity;
  }

  noteOff(when = this.ctx.currentTime) {
    const press = this.p('pressure');
    holdAt(press, when);
    press.setTargetAtTime(0, when, this.m.release / 3);
    holdAt(this.p('vibratoDepth'), when);
    this.p('vibratoDepth').setTargetAtTime(0, when, 0.1);
    this.soundingUntil = when;
    this.sounding = false;
  }

  play(midi: number, when: number, dur: number, opts: NoteOptions = {}) {
    this.noteOn(midi, when, { ...opts, legato: opts.legato ?? false });
    this.sounding = true;
    this.soundingUntil = when + dur;
    const press = this.p('pressure');
    holdAt(press, when + dur);
    press.setTargetAtTime(0, when + dur, this.m.release / 3);
  }

  setBend(cents: number, glideTime = 0.06) {
    this.p('pitchBend').setTargetAtTime(cents, this.ctx.currentTime, glideTime / 3);
  }

  setVibrato(amount: number) {
    this.manualVibrato = amount;
    if (!this.sounding) return;
    const v = this.p('vibratoDepth');
    holdAt(v, this.ctx.currentTime);
    v.setTargetAtTime(this.m.vibratoDepth * (1 + amount * 1.5), this.ctx.currentTime, 0.08);
  }

  setBreath(breath: number) {
    this.breath = breath;
    if (!this.sounding) return;
    const press = this.p('pressure');
    holdAt(press, this.ctx.currentTime);
    press.setTargetAtTime(pressureFor(breath), this.ctx.currentTime, 0.04);
  }

  stop() {
    const now = this.ctx.currentTime;
    const press = this.p('pressure');
    press.cancelScheduledValues(now);
    press.setTargetAtTime(0, now, 0.02);
    this.sounding = false;
    this.soundingUntil = 0;
  }

  dispose() {
    this.stop();
    setTimeout(() => {
      this.node.port.postMessage('dispose');
      this.out.disconnect();
    }, 300);
  }
}

export type SoundSource = 'recorded' | 'modelled' | 'mine';
let soundSource: SoundSource = 'recorded';
const voices = new Set<HybridVoice>();
customVersion.listeners.add(() => { for (const v of voices) v.refresh(); });

/** Switch every voice between real recordings and the physical model. */
export function setSoundSource(src: SoundSource) {
  soundSource = src;
  for (const v of voices) v.refresh();
}

/**
 * The voice the app uses. Real recordings when chosen and loaded; otherwise the physical model;
 * the simple synth only until the model's worklet has loaded (or if AudioWorklet is missing).
 */
export class HybridVoice implements Voice {
  private synth: FluteVoice;
  private model: ModelVoiceImpl | null = null;
  private sampler: SampleVoice | null = null;
  private loadingSet: string | null = null;
  private timbre: Timbre;

  constructor(timbre: Timbre, private dest: AudioNode) {
    this.timbre = timbre;
    this.synth = new FluteVoice(timbre, dest);
    voices.add(this);
    if (timbre.model) {
      loadFluteModel()
        .then(() => {
          this.synth.stop();
          this.model = new ModelVoiceImpl(this.timbre, this.dest);
        })
        .catch(() => { /* keep the synth */ });
    }
    this.refresh();
  }

  private mine: SampleVoice | null = null;
  private mineKey = '';

  /** Load the recordings for the current flute if they're wanted and not loaded yet. */
  refresh() {
    if (soundSource === 'mine') this.refreshMine();
    const id = this.timbre.sampleSet;
    if (soundSource === 'modelled' || !id || this.sampler?.setId === id || this.loadingSet === id) return;
    this.loadingSet = id;
    fetch(`/samples/${id}.json`)
      .then((r) => r.json() as Promise<SampleSetManifest>)
      .then((m) => loadSampleSet(m, '/samples/'))
      .then((samples) => {
        if (this.timbre.sampleSet !== id) return;
        this.sampler?.dispose();
        this.sampler = new SampleVoice(id, samples, this.timbre, this.dest);
      })
      .catch((e) => console.warn('[flute] recordings unavailable, using the model', e))
      .finally(() => { if (this.loadingSet === id) this.loadingSet = null; });
  }

  /** The player's own recordings for this flute and key. */
  private refreshMine() {
    const set = this.timbre.customSet;
    if (!set) return;
    const key = `${set}#${customVersion.n}`;
    if (key === this.mineKey) return;
    this.mineKey = key;
    void customNotes.list(set).then(async (notes) => {
      if (this.mineKey !== key) return;
      if (!notes.length) { this.mine?.dispose(); this.mine = null; return; }
      const samples = await loadSamplesFromBlobs(notes);
      if (this.mineKey !== key) return;
      this.mine?.dispose();
      this.mine = new SampleVoice('mine:' + set, samples, this.timbre, this.dest);
    });
  }

  private get v(): Voice {
    if (soundSource === 'mine' && this.mine && this.mine.setId === 'mine:' + this.timbre.customSet) return this.mine;
    if (soundSource !== 'modelled' && this.sampler && this.sampler.setId === this.timbre.sampleSet) return this.sampler;
    return this.model ?? this.synth;
  }

  setTimbre(t: Timbre) {
    const prev = this.v;
    this.timbre = t;
    this.synth.setTimbre(t);
    if (this.model && t.model) this.model.setTimbre(t);
    else if (!this.model && t.model && moduleLoaded) this.model = new ModelVoiceImpl(t, this.dest);
    this.sampler?.setTimbre(t);
    this.mine?.setTimbre(t);
    if (prev !== this.v) prev.stop();
    this.refresh();
  }
  get isSounding() { return this.v.isSounding; }
  noteOn(midi: number, when?: number, opts?: NoteOptions) { this.v.noteOn(midi, when, opts); }
  noteOff(when?: number) { this.v.noteOff(when); }
  play(midi: number, when: number, dur: number, opts?: NoteOptions) { this.v.play(midi, when, dur, opts); }
  setBend(cents: number, glideTime?: number) { this.v.setBend(cents, glideTime); }
  setVibrato(amount: number) { this.v.setVibrato(amount); }
  setBreath(breath: number) { this.v.setBreath(breath); }
  stop() { this.synth.stop(); this.model?.stop(); this.sampler?.stop(); this.mine?.stop(); }
  dispose() { voices.delete(this); this.synth.dispose(); this.model?.dispose(); this.sampler?.dispose(); this.mine?.dispose(); }
}
