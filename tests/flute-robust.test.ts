import { it } from 'vitest';
import { run } from './flute-detail.test';

it.skipIf(!process.env.ROBUST)('robust', () => {
  const cfg = JSON.parse(process.env.ROBUST!);
  let good = 0, total = 0;
  const bad: string[] = [];
  const cents: number[] = [];
  for (let midi = 55; midi <= 98; midi++) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    for (const pressure of cfg.pressures) for (const noise of [0.05, 0.15]) for (const vibratoDepth of [0, 0.6]) {
      const r = run(cfg, f, { pressure, noise, vibratoDepth, vibratoRate: 5, airMix: 0, ...cfg.params });
      total++;
      if (Math.abs(r.c) < 30 && r.clar > 0.9) { good++; cents.push(r.c); } else bad.push(`${midi}@${pressure}/${noise}/${vibratoDepth}:${isNaN(r.c) ? '---' : r.c.toFixed(0)}`);
    }
  }
  const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
  console.log(`GOOD ${good}/${total} mean=${mean.toFixed(1)}c\n` + bad.slice(0, 30).join(' '));
});
