import { engine } from './engine';
import { encodeWav } from './recorder';
import { yin } from './pitch';

/**
 * "Record your own flute": captures single notes from the microphone, keeps the steady part,
 * checks the pitch, and stores them (in this browser) as a sample set the app can play.
 */

export interface CustomNote {
  key: string; // `${setId}|${midi}`
  setId: string;
  midi: number;
  cents: number;
  seconds: number;
  wav: Blob;
  created: number;
}

const DB = 'flute-custom-samples';
const STORE = 'notes';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const customNotes = {
  async list(setId: string): Promise<CustomNote[]> {
    try {
      const all = await run<CustomNote[]>('readonly', (s) => s.getAll() as IDBRequest<CustomNote[]>);
      return all.filter((n) => n.setId === setId).sort((a, b) => a.midi - b.midi);
    } catch {
      return [];
    }
  },
  save: (n: CustomNote) => run('readwrite', (s) => s.put(n)),
  remove: (setId: string, midi: number) => run('readwrite', (s) => s.delete(`${setId}|${midi}`)),
};

/** Changes to custom recordings, so voices can reload them. */
export const customVersion = { n: 0, listeners: new Set<() => void>() };
export function bumpCustom() {
  customVersion.n++;
  for (const l of customVersion.listeners) l();
}

const CAPTURE = `
class MicCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;
let captureReady: Promise<void> | null = null;

export interface TakeResult {
  ok: boolean;
  message: string;
  heardMidi: number | null;
  cents: number;
  seconds: number;
  wav?: Blob;
}

/** Records from the microphone until `stop()` is called (or maxSeconds), then analyses the take. */
export class NoteTaker {
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private timer = 0;
  level = 0;

  async start(maxSeconds = 6, onAutoStop?: () => void) {
    const ctx = engine.ensure();
    if (!captureReady) {
      captureReady = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([CAPTURE], { type: 'text/javascript' })));
    }
    await captureReady;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(ctx, 'mic-capture', { numberOfOutputs: 0 });
    this.chunks = [];
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.chunks.push(e.data);
      let s = 0;
      for (const x of e.data) s += x * x;
      this.level = Math.sqrt(s / e.data.length);
    };
    this.src.connect(this.node);
    this.timer = window.setTimeout(() => onAutoStop?.(), maxSeconds * 1000);
  }

  stop(targetMidi: number): TakeResult {
    clearTimeout(this.timer);
    this.src?.disconnect();
    this.node?.port.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    const sr = engine.ctx.sampleRate;
    const total = this.chunks.reduce((a, c) => a + c.length, 0);
    const data = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) { data.set(c, o); o += c.length; }
    return analyseTake(data, sr, targetMidi);
  }

  cancel() {
    clearTimeout(this.timer);
    this.src?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Finds the longest steady stretch near the wanted note, keeps a little of the attack before it,
 * and normalises the level.
 */
export function analyseTake(data: Float32Array, sr: number, target: number): TakeResult {
  const win = 2048, hop = 512;
  const frames: { t: number; midi: number | null; rms: number }[] = [];
  for (let i = 0; i + win < data.length; i += hop) {
    const seg = data.subarray(i, i + win);
    let s = 0;
    for (const x of seg) s += x * x;
    const rms = Math.sqrt(s / win);
    const r = rms > 0.01 ? yin(seg, sr, 100, 3500, 0.15) : { freq: null, clarity: 0 };
    frames.push({ t: i, rms, midi: r.freq && r.clarity > 0.8 ? 69 + 12 * Math.log2(r.freq / 440) : null });
  }
  // Longest run of frames within a semitone of the target (any octave counts as "heard wrong octave").
  let best = { a: -1, b: -1 }, a = -1;
  let heard: number[] = [];
  for (let i = 0; i <= frames.length; i++) {
    const f = frames[i];
    const ok = f && f.midi !== null && Math.abs(f.midi - target) < 0.6;
    if (f?.midi !== null && f?.midi !== undefined) heard.push(f.midi);
    if (ok && a < 0) a = i;
    if (!ok && a >= 0) {
      if (i - a > best.b - best.a) best = { a, b: i };
      a = -1;
    }
  }
  const steadySeconds = ((best.b - best.a) * hop) / sr;
  if (best.a < 0 || steadySeconds < 0.6) {
    heard = heard.sort((x, y) => x - y);
    const med = heard.length ? heard[Math.floor(heard.length / 2)] : null;
    const msg = med === null
      ? 'I didn’t hear a clear note. Play closer to the microphone, a steady long note.'
      : Math.abs(med - target) >= 0.6
        ? `That sounded like a different note (${Math.round(med - target) > 0 ? 'higher' : 'lower'} by ${Math.abs(Math.round(med - target))} semitone${Math.abs(Math.round(med - target)) === 1 ? '' : 's'}). Check the fingering and try again.`
        : 'The note wasn’t steady for long enough. Hold it for at least two seconds.';
    return { ok: false, message: msg, heardMidi: med === null ? null : Math.round(med), cents: 0, seconds: steadySeconds };
  }
  const steady = frames.slice(best.a, best.b).map((f) => f.midi!) .sort((x, y) => x - y);
  const cents = (steady[Math.floor(steady.length / 2)] - target) * 100;
  // Include the attack: walk back from the steady part while there's sound.
  let startFrame = best.a;
  while (startFrame > 0 && frames[startFrame - 1].rms > 0.01 && best.a - startFrame < (0.25 * sr) / hop) startFrame--;
  const start = Math.max(0, frames[startFrame].t - Math.floor(0.01 * sr));
  const end = Math.min(data.length, frames[best.b - 1].t + win + Math.floor(0.05 * sr));
  const clip = data.slice(start, end);
  // Normalise steady RMS to −18 dB, fades at both ends.
  let s = 0;
  const steadyFrom = frames[best.a].t - start, steadyTo = Math.min(clip.length, frames[best.b - 1].t - start);
  for (let i = steadyFrom; i < steadyTo; i++) s += clip[i] * clip[i];
  const rms = Math.sqrt(s / Math.max(1, steadyTo - steadyFrom));
  const gain = Math.min(20, 0.126 / Math.max(1e-4, rms));
  const fadeIn = Math.floor(0.004 * sr), fadeOut = Math.floor(0.04 * sr);
  for (let i = 0; i < clip.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > clip.length - fadeOut) g *= (clip.length - i) / fadeOut;
    clip[i] = Math.max(-1, Math.min(1, clip[i] * g));
  }
  const wav = encodeWav([clip], [clip], clip.length, sr);
  const inTune = Math.abs(cents) < 15;
  return {
    ok: true,
    message: inTune ? `Got it: ${steadySeconds.toFixed(1)} s steady, ${cents >= 0 ? '+' : ''}${cents.toFixed(0)}¢.` : `Got it, ${cents >= 0 ? '+' : ''}${cents.toFixed(0)}¢ off. The app corrects the pitch, but a more in-tune take will sound more natural.`,
    heardMidi: target,
    cents,
    seconds: steadySeconds,
    wav,
  };
}
