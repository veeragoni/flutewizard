import { engine } from './engine';

/**
 * Microphone pitch tracking for the tuner and "My flute" mode, using the YIN algorithm
 * (de Cheveigné & Kawahara, 2002). Flutes give clean, nearly sinusoidal tones, so YIN with a
 * low threshold is accurate to a cent or two.
 */

export interface PitchReading {
  freq: number | null;
  /** 0..1, how periodic the signal is. */
  clarity: number;
  /** RMS level 0..1. */
  level: number;
}

export function yin(buf: Float32Array, sampleRate: number, minFreq = 150, maxFreq = 3000, threshold = 0.12): { freq: number | null; clarity: number } {
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const W = buf.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalized difference.
  let running = 0;
  d[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    d[tau] = running ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // No dip below threshold: take the global minimum but report low clarity.
    let best = minTau;
    for (let t = minTau; t <= maxTau; t++) if (d[t] < d[best]) best = t;
    if (d[best] > 0.35) return { freq: null, clarity: 1 - d[best] };
    tau = best;
  }
  // Parabolic interpolation for sub-sample accuracy.
  const a = d[tau - 1] ?? d[tau], b = d[tau], c = d[tau + 1] ?? d[tau];
  const denom = a - 2 * b + c;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  return { freq: sampleRate / (tau + shift), clarity: Math.max(0, 1 - b) };
}

export class MicPitch {
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private buf = new Float32Array(new ArrayBuffer(4096 * 4));
  private raf = 0;
  minFreq = 150;
  maxFreq = 3200;

  get active() {
    return !!this.stream;
  }

  /** `onEnded`: the microphone went away (unplugged, switched device, permission revoked). */
  async start(onReading: (r: PitchReading) => void, onEnded?: () => void) {
    const ctx = engine.ensure();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const stream = this.stream;
    for (const t of stream.getAudioTracks()) {
      t.addEventListener('ended', () => {
        if (this.stream !== stream) return;
        this.stop();
        onEnded?.();
      });
    }
    this.src = ctx.createMediaStreamSource(this.stream);
    // A gentle high-pass removes rumble and handling noise.
    const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 100 });
    this.analyser = new AnalyserNode(ctx, { fftSize: 4096 });
    this.src.connect(hp).connect(this.analyser);
    const loop = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      const level = Math.sqrt(sum / this.buf.length);
      if (level < 0.006) onReading({ freq: null, clarity: 0, level });
      else {
        // Use 2048 samples for speed; enough for notes down to ~50 Hz at 48 kHz.
        const r = yin(this.buf.subarray(0, 2048), ctx.sampleRate, this.minFreq, this.maxFreq);
        onReading({ ...r, level });
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.src?.disconnect();
    this.stream = null;
    this.analyser = null;
    this.src = null;
  }
}

/**
 * Turns a stream of noisy readings into note onsets: a note "starts" once the same pitch has been
 * heard steadily for a few frames, which avoids firing on breath noise and transitions.
 */
export class NoteTracker {
  private candidate: number | null = null;
  private count = 0;
  current: number | null = null;
  constructor(private onNote: (midi: number | null) => void, private framesNeeded = 3) {}

  push(midi: number | null) {
    if (midi === this.candidate) this.count++;
    else {
      this.candidate = midi;
      this.count = 1;
    }
    const need = midi === null ? 6 : this.framesNeeded;
    if (this.count >= need && this.candidate !== this.current) {
      this.current = this.candidate;
      this.onNote(this.current);
    }
  }
}
