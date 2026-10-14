// Pitch/level analysis of audio files: prints median pitch and stable-pitch segments.
import { execFileSync } from 'node:child_process';
const SR = 44100;
export function decode(file) {
  const buf = execFileSync('ffmpeg', ['-v', 'quiet', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
export function yin(x, minF = 150, maxF = 3000, thr = 0.12) {
  const maxTau = Math.min(Math.floor(SR / minF), Math.floor(x.length / 2));
  const minTau = Math.floor(SR / maxF);
  const W = x.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let t = 1; t <= maxTau; t++) { let s = 0; for (let i = 0; i < W; i++) { const q = x[i] - x[i + t]; s += q * q; } d[t] = s; }
  let run = 0; d[0] = 1;
  for (let t = 1; t <= maxTau; t++) { run += d[t]; d[t] = run ? (d[t] * t) / run : 1; }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) if (d[t] < thr) { while (t + 1 <= maxTau && d[t + 1] < d[t]) t++; tau = t; break; }
  if (tau < 0) return null;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? b;
  const den = a - 2 * b + c;
  return SR / (tau + (den ? (a - c) / (2 * den) : 0));
}
export function track(x, hop = 0.02) {
  const out = [];
  const n = 2048, h = Math.floor(SR * hop);
  for (let i = 0; i + n < x.length; i += h) {
    const seg = x.subarray(i, i + n);
    let s = 0; for (const v of seg) s += v * v;
    const rms = Math.sqrt(s / n);
    const f = rms > 0.005 ? yin(seg) : null;
    out.push({ t: i / SR, rms, midi: f ? 69 + 12 * Math.log2(f / 440) : null });
  }
  return out;
}
const median = (a) => { const b = [...a].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
export function segments(tr, minDur = 0.35) {
  const segs = [];
  let cur = null;
  for (const p of tr) {
    const m = p.midi === null ? null : Math.round(p.midi);
    if (cur && m === cur.note) { cur.end = p.t; cur.vals.push(p.midi); cur.peak = Math.max(cur.peak, p.rms); }
    else {
      if (cur && cur.end - cur.start >= minDur) segs.push(cur);
      cur = m === null ? null : { note: m, start: p.t, end: p.t, vals: [p.midi], peak: p.rms };
    }
  }
  if (cur && cur.end - cur.start >= minDur) segs.push(cur);
  return segs.map((s) => ({ note: s.note, start: +s.start.toFixed(2), end: +s.end.toFixed(2), cents: Math.round((median(s.vals) - s.note) * 100), peak: +s.peak.toFixed(3) }));
}
if (process.argv[1]?.endsWith('analyze-samples.mjs')) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const nn = (m) => names[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  for (const f of process.argv.slice(2)) {
    const x = decode(f);
    const tr = track(x);
    const segs = segments(tr);
    const base = f.split('/').pop();
    console.log(`${base}  dur=${(x.length / SR).toFixed(1)}s  ` + segs.map((s) => `${nn(s.note)}${s.cents >= 0 ? '+' : ''}${s.cents}c[${s.start}-${s.end}]`).join(' '));
  }
}
