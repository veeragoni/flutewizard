import { it } from 'vitest';
import { run } from './flute-detail.test';

it.skipIf(!process.env.TUNE)('tune curve', () => {
  const cfg = JSON.parse(process.env.TUNE!);
  const rows: string[] = [];
  for (let midi = 48; midi <= 100; midi += 2) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const cs = [0.9, 0.97, 1.03].map((pressure) => run(cfg, f, { pressure, noise: 0.08, vibratoDepth: 0, airMix: 0, ...cfg.params }).c);
    rows.push(`${midi} ${cs.map((c) => (isNaN(c) ? '---' : c.toFixed(1))).join(' ')}`);
  }
  console.log('TUNE\n' + rows.join('\n'));
});
