/**
 * Shared AudioContext and the master effects chain:
 *
 *   instrument ─┐
 *   backing ────┼─► EQ (low shelf, presence, air) ─► warmth ─► dry ───────────────┐
 *   metronome ──┘                                  ├──► delay (filtered feedback)──┼─► compressor ─► master ─► speakers
 *                                                  └──► reverb (generated IR) ─────┘                      └─► recorder tap
 */

export interface FxSettings {
  reverb: number; // 0..1 wet
  room: RoomId;
  delay: number; // 0..1 wet
  delayTime: number; // seconds
  delayFeedback: number; // 0..0.9
  bass: number; // dB
  mid: number; // dB (presence ~2.5 kHz)
  treble: number; // dB (air ~8 kHz)
  warmth: number; // 0..1 gentle tape-style saturation
}

export type RoomId = 'studio' | 'room' | 'hall' | 'temple' | 'cathedral';

export const ROOMS: Record<RoomId, { label: string; seconds: number; decay: number; damp: number }> = {
  studio: { label: 'Studio', seconds: 0.6, decay: 4, damp: 6000 },
  room: { label: 'Room', seconds: 1.2, decay: 3, damp: 5000 },
  hall: { label: 'Concert hall', seconds: 2.6, decay: 2.6, damp: 4200 },
  temple: { label: 'Stone temple', seconds: 4.2, decay: 2.2, damp: 3500 },
  cathedral: { label: 'Cathedral', seconds: 6.5, decay: 1.8, damp: 3000 },
};

export const DEFAULT_FX: FxSettings = {
  reverb: 0.28,
  room: 'hall',
  delay: 0,
  delayTime: 0.36,
  delayFeedback: 0.3,
  bass: 0,
  mid: 0,
  treble: 0,
  warmth: 0.15,
};

export interface Bus {
  input: GainNode;
  volume: GainNode;
}

class Engine {
  ctx!: AudioContext;
  master!: GainNode;
  /** Everything that should be recorded passes through here. */
  tap!: GainNode;
  instrument!: Bus;
  guide!: Bus;
  backing!: Bus;
  click!: Bus;
  private low!: BiquadFilterNode;
  private mid!: BiquadFilterNode;
  private high!: BiquadFilterNode;
  private shaper!: WaveShaperNode;
  private dry!: GainNode;
  private delay!: DelayNode;
  private delayFb!: GainNode;
  private delayWet!: GainNode;
  private convolver!: ConvolverNode;
  private reverbWet!: GainNode;
  private currentRoom: RoomId | null = null;
  private started = false;

  /** Creates the context lazily; must be called from a user gesture the first time. */
  ensure(): AudioContext {
    if (this.started) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    this.started = true;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    const fxIn = ctx.createGain();
    this.low = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 220 });
    this.mid = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 2500, Q: 0.9 });
    this.high = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 8000 });
    this.shaper = new WaveShaperNode(ctx, { oversample: '2x' });
    this.dry = ctx.createGain();
    this.delay = new DelayNode(ctx, { maxDelayTime: 2 });
    this.delayFb = ctx.createGain();
    this.delayWet = ctx.createGain();
    const delayTone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3500 });
    this.convolver = ctx.createConvolver();
    this.reverbWet = ctx.createGain();
    const comp = new DynamicsCompressorNode(ctx, { threshold: -14, knee: 12, ratio: 3, attack: 0.01, release: 0.25 });
    this.master = new GainNode(ctx, { gain: 0.9 });
    this.tap = ctx.createGain();

    fxIn.connect(this.low).connect(this.mid).connect(this.high).connect(this.shaper);
    this.shaper.connect(this.dry).connect(comp);
    this.shaper.connect(this.delay);
    this.delay.connect(delayTone).connect(this.delayFb).connect(this.delay);
    delayTone.connect(this.delayWet).connect(comp);
    this.shaper.connect(this.convolver).connect(this.reverbWet).connect(comp);
    comp.connect(this.master).connect(this.tap).connect(ctx.destination);

    const bus = (gain: number): Bus => {
      const input = ctx.createGain();
      const volume = new GainNode(ctx, { gain });
      input.connect(volume).connect(fxIn);
      return { input, volume };
    };
    this.instrument = bus(1);
    this.guide = bus(0.7);
    this.backing = bus(0.55);
    this.click = bus(0.6);
    return ctx;
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  applyFx(fx: FxSettings) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, 0.03);
    set(this.low.gain, fx.bass);
    set(this.mid.gain, fx.mid);
    set(this.high.gain, fx.treble);
    set(this.delayWet.gain, fx.delay * 0.6);
    set(this.delay.delayTime, fx.delayTime);
    set(this.delayFb.gain, Math.min(0.9, fx.delayFeedback));
    set(this.reverbWet.gain, fx.reverb * 1.4);
    set(this.dry.gain, 1 - fx.reverb * 0.35);
    this.shaper.curve = saturationCurve(fx.warmth);
    if (this.currentRoom !== fx.room) {
      this.currentRoom = fx.room;
      this.convolver.buffer = makeImpulse(this.ctx, fx.room);
    }
  }

  setVolume(bus: 'instrument' | 'guide' | 'backing' | 'click' | 'master', v: number) {
    if (!this.started) return;
    const node = bus === 'master' ? this.master : this[bus].volume;
    node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }
}

export const engine = new Engine();

function saturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 0.001 + amount * 3;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/** Stereo impulse response: exponentially decaying noise with early reflections and high damping. */
function makeImpulse(ctx: BaseAudioContext, room: RoomId): AudioBuffer {
  const { seconds, decay, damp } = ROOMS[room];
  const rate = ctx.sampleRate;
  const len = Math.floor(seconds * rate);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    const early = [0.011, 0.019, 0.027, 0.041, 0.053].map((s) => Math.floor((s + c * 0.003) * rate));
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // Damping increases over time: later reflections are darker.
      const a = Math.exp(-2 * Math.PI * (damp * (1 - 0.7 * t)) / rate);
      lp = a * lp + (1 - a) * (Math.random() * 2 - 1);
      d[i] = lp * Math.pow(1 - t, decay) * 1.8;
    }
    for (const e of early) if (e < len) d[e] += (Math.random() < 0.5 ? -1 : 1) * 0.5;
    // Short fade-in avoids a click at the very start.
    for (let i = 0; i < Math.min(len, 64); i++) d[i] *= i / 64;
  }
  return buf;
}

let noiseBuf: AudioBuffer | null = null;
/** Two seconds of white noise, shared by every voice. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** cancelAndHoldAtTime where supported, otherwise cancel + pin the current value. */
export function holdAt(p: AudioParam, t: number) {
  const anyP = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
  if (anyP.cancelAndHoldAtTime) anyP.cancelAndHoldAtTime(t);
  else {
    const v = p.value;
    p.cancelScheduledValues(t);
    p.setValueAtTime(v, t);
  }
}
