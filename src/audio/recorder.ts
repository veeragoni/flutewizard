import { engine } from './engine';

/**
 * Records everything you hear (flute, band, drone, effects) for up to 10 minutes.
 * Captures raw PCM through an AudioWorklet so a lossless WAV can be exported, and runs a
 * MediaRecorder in parallel for a small compressed file. Takes are kept in IndexedDB.
 */

export const MAX_SECONDS = 600;

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const l = input[0], r = input[1] || input[0];
      this.port.postMessage([l.slice(0), r.slice(0)]);
    }
    return true;
  }
}
registerProcessor('flute-capture', Capture);
`;

export interface Take {
  id: string;
  name: string;
  created: number;
  seconds: number;
  wav: Blob;
  compressed?: Blob;
  instrument: string;
  song?: string;
}

let workletReady: Promise<void> | null = null;

export class Recorder {
  private node: AudioWorkletNode | null = null;
  private chunksL: Float32Array[] = [];
  private chunksR: Float32Array[] = [];
  private frames = 0;
  private media: MediaRecorder | null = null;
  private mediaChunks: Blob[] = [];
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private startedAt = 0;
  onLimit: (() => void) | null = null;

  get recording() {
    return !!this.node;
  }

  get elapsed() {
    return this.node ? engine.now - this.startedAt : 0;
  }

  async start() {
    const ctx = engine.ensure();
    if (!workletReady) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      workletReady = ctx.audioWorklet.addModule(url);
    }
    await workletReady;
    this.chunksL = [];
    this.chunksR = [];
    this.frames = 0;
    this.node = new AudioWorkletNode(ctx, 'flute-capture', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit' });
    const maxFrames = MAX_SECONDS * ctx.sampleRate;
    this.node.port.onmessage = (e: MessageEvent<[Float32Array, Float32Array]>) => {
      if (this.frames >= maxFrames) {
        this.onLimit?.();
        return;
      }
      this.chunksL.push(e.data[0]);
      this.chunksR.push(e.data[1]);
      this.frames += e.data[0].length;
    };
    engine.tap.connect(this.node);

    this.mediaChunks = [];
    if (typeof MediaRecorder !== 'undefined') {
      this.streamDest = ctx.createMediaStreamDestination();
      engine.tap.connect(this.streamDest);
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
      try {
        this.media = new MediaRecorder(this.streamDest.stream, type ? { mimeType: type, audioBitsPerSecond: 128000 } : undefined);
        this.media.ondataavailable = (e) => e.data.size && this.mediaChunks.push(e.data);
        this.media.start(1000);
      } catch {
        this.media = null;
      }
    }
    this.startedAt = ctx.currentTime;
  }

  async stop(): Promise<{ wav: Blob; compressed?: Blob; seconds: number } | null> {
    if (!this.node) return null;
    const ctx = engine.ctx;
    engine.tap.disconnect(this.node);
    this.node.port.onmessage = null;
    this.node = null;
    let compressed: Blob | undefined;
    if (this.media) {
      const media = this.media;
      compressed = await new Promise<Blob>((resolve) => {
        media.onstop = () => resolve(new Blob(this.mediaChunks, { type: media.mimeType }));
        media.stop();
      });
      this.media = null;
    }
    if (this.streamDest) {
      engine.tap.disconnect(this.streamDest);
      this.streamDest = null;
    }
    const wav = encodeWav(this.chunksL, this.chunksR, this.frames, ctx.sampleRate);
    return { wav, compressed, seconds: this.frames / ctx.sampleRate };
  }
}

export function encodeWav(left: Float32Array[], right: Float32Array[], frames: number, rate: number): Blob {
  const bytes = 44 + frames * 4;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, bytes - 8, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, frames * 4, true);
  let o = 44;
  for (let c = 0; c < left.length; c++) {
    const L = left[c], R = right[c];
    for (let i = 0; i < L.length && o < bytes; i++) {
      v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 0x7fff, true);
      v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 0x7fff, true);
      o += 4;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/* ───────────────────────────── Take storage ───────────────────────────── */

const DB = 'flute-recordings';
const STORE = 'takes';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const takes = {
  list: async (): Promise<Take[]> => {
    try {
      const all = await tx<Take[]>('readonly', (s) => s.getAll() as IDBRequest<Take[]>);
      return all.sort((a, b) => b.created - a.created);
    } catch {
      return [];
    }
  },
  save: (t: Take) => tx('readwrite', (s) => s.put(t)),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
};

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function extFor(blob: Blob): string {
  return blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
}
