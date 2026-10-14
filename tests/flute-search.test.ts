import { it } from 'vitest';
// @ts-expect-error plain JS module
import { FluteDSP } from '../src/audio/worklets/flute-worklet.js';
import { yin } from '../src/audio/pitch';

const SR = 48000;
function measure(cfg: { boreScale: number; sign: number }, freq: number, params: Record<string, number>) {
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
  const r = yin(seg, SR, 80, 5000);
  return r.freq && r.clarity > 0.85 ? 1200 * Math.log2(r.freq / freq) : NaN;
}

it.skipIf(!process.env.SEARCH)('search', () => {
  const notes = [55, 60, 67, 72, 79, 84, 91, 96];
  const results: string[] = [];
  for (const boreScale of [0.5, 1, 1.5]) for (const sign of [1, -1]) for (const jetRatio of [0.15, 0.25, 0.32, 0.4, 0.5, 0.6, 0.75]) for (const damping of [0.5, 0.7]) {
    let good = 0, total = 0;
    for (const midi of notes) for (const pressure of [0.45, 0.7, 0.95]) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const c = measure({ boreScale, sign }, f, { pressure, jetRatio, damping, noise: 0.1, airMix: 0, vibratoDepth: 0 });
      total++;
      if (Math.abs(c) < 25) good++;
    }
    results.push(`${(good / total).toFixed(2)} bore=${boreScale} sign=${sign} jet=${jetRatio} damp=${damping}`);
  }
  results.sort().reverse();
  console.log(results.slice(0, 15).join('\n'));
});
