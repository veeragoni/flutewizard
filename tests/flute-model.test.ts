import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module
import { FluteDSP } from '../src/audio/worklets/flute-worklet.js';
import { yin } from '../src/audio/pitch';

const SR = 48000;

function render(freq: number, opts: Record<string, number> = {}, seconds = 1.2) {
  const dsp = new FluteDSP(SR);
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const block = 128;
  for (let i = 0; i < n; i += block) {
    const t = i / SR;
    // Quick attack envelope.
    const press = (opts.pressure ?? 0.9) * Math.min(1, t / 0.05);
    dsp.process(out.subarray(i, i + block), Math.min(block, n - i), { ...opts, frequency: freq, pressure: press });
  }
  return out;
}

export function measure(freq: number, opts: Record<string, number> = {}) {
  const out = render(freq, opts);
  const seg = out.subarray(SR * 0.6, SR * 0.6 + 4096);
  let rms = 0;
  for (const x of seg) rms += x * x;
  rms = Math.sqrt(rms / seg.length);
  const r = yin(seg, SR, 100, 4000);
  const cents = r.freq ? 1200 * Math.log2(r.freq / freq) : NaN;
  return { freq: r.freq, cents, rms, clarity: r.clarity };
}

describe('flute model', () => {
  it('report', () => {
    const rows: string[] = [];
    for (const midi of [55, 60, 64, 67, 72, 76, 79, 84, 88, 91, 96]) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      for (const pressure of [0.6, 0.9]) {
        const m = measure(f, { pressure });
        rows.push(`${midi} p=${pressure} -> ${m.freq?.toFixed(1)} Hz (${m.cents.toFixed(1)}c) rms=${m.rms.toFixed(3)} clar=${m.clarity.toFixed(2)}`);
      }
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBeGreaterThan(0);
  });
});
