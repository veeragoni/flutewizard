import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { yin } from '../src/audio/pitch';

// Offline harness: runs the mic detector over real recordings, frame by frame, the way "My flute"
// mode does, and counts readings that land on the wrong note. Run with PITCH=1 (needs ffmpeg).
const SR = 48000;
function decode(file: string): Float32Array {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

export function scan(x: Float32Array, minF: number, maxF: number, gain = 1) {
  const out: (number | null)[] = [];
  for (let i = 0; i + 2048 <= x.length; i += 800) {
    const seg = x.slice(i, i + 2048).map((v) => v * gain);
    let s = 0;
    for (const v of seg) s += v * v;
    if (Math.sqrt(s / 2048) < 0.006) { out.push(null); continue; }
    const r = yin(seg, SR, minF, maxF);
    out.push(r.freq && r.clarity > 0.8 ? 69 + 12 * Math.log2(r.freq / 440) : null);
  }
  return out;
}

describe.skipIf(!process.env.PITCH)('mic pitch on real bansuri', () => {
  it('reads each recorded note as itself', () => {
    const dir = 'public/samples/bansuri';
    const lo = 59 - 2, hi = 83 + 2; // E bansuri range, as startMic() sets it
    const minF = 440 * 2 ** ((lo - 69) / 12), maxF = 440 * 2 ** ((hi - 69) / 12);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.mp3'))) {
      const want = parseInt(f, 10);
      for (const gain of [1, 0.15]) {
        const r = scan(decode(`${dir}/${f}`), minF, maxF, gain).filter((m): m is number => m !== null);
        const wrong = r.filter((m) => Math.round(m) !== want && Math.abs(m - want) > 0.7);
        const kinds = [...new Set(wrong.map((m) => Math.round(m - want)))];
        console.log(`${want} gain ${gain}: ${r.length} readings, ${wrong.length} wrong`, kinds.join(','));
      }
    }
  });
});
