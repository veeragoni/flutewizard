import { it } from 'vitest';
// @ts-expect-error plain JS module
import { FluteDSP } from '../src/audio/worklets/flute-worklet.js';
import { yin } from '../src/audio/pitch';

const SR = 48000;
export function run(cfg: { boreScale: number; sign: number }, freq: number, params: Record<string, number>) {
  const dsp = new FluteDSP(SR);
  dsp.boreScale = cfg.boreScale;
  dsp.sign = cfg.sign;
  const n = Math.floor(SR * 0.8);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 128) {
    const press = params.pressure * Math.min(1, i / SR / 0.05);
    dsp.process(out.subarray(i, i + 128), Math.min(128, n - i), { ...params, frequency: freq, pressure: press });
  }
  const seg = out.subarray(SR * 0.5, SR * 0.5 + 4096);
  let rms = 0; for (const x of seg) rms += x * x; rms = Math.sqrt(rms / seg.length);
  const r = yin(seg, SR, 80, 5000);
  return { c: r.freq ? 1200 * Math.log2(r.freq / freq) : NaN, clar: r.clarity, rms };
}

it.skipIf(!process.env.DETAIL)('detail', () => {
  const cfg = JSON.parse(process.env.DETAIL!);
  const rows: string[] = [];
  for (const midi of [55, 60, 67, 72, 79, 84, 91, 96]) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const cells = [0.8, 0.85, 0.9, 1.1, 1.4, 1.8].map((pressure) => {
      const r = run(cfg, f, { pressure, noise: 0.1, airMix: 0, vibratoDepth: 0, ...cfg.params });
      return `${pressure}:${isNaN(r.c) ? '---' : r.c.toFixed(0)}/${r.clar.toFixed(2)}/${r.rms.toFixed(2)}`;
    });
    rows.push(`${midi}  ${cells.join('  ')}`);
  }
  console.log(rows.join('\n'));
});
