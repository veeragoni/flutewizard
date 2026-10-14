import { describe, expect, it } from 'vitest';
import { BANSURI, CONCERT, RECORDER, WHISTLE, labelBox, spotBox, type FluteGeometry, type Label } from '../src/ui/fluteGeometry';

type Box = { x0: number; x1: number; y0: number; y1: number };
const hit = (a: Box, b: Box, gap = 2) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

/** Every overlap between labels, keys/holes and the tube. Phone scale draws labels 1.7× and hides minor ones. */
function overlaps(g: FluteGeometry, phone: boolean): string[] {
  const scale = phone ? 1.7 : 1;
  const labels: Label[] = [...g.spots.map((s) => s.label), ...g.extra].filter((l): l is Label => !!l && !(phone && l.minor));
  const lb = labels.map((l) => ({ l, b: labelBox(l, scale) }));
  const problems: string[] = [];
  lb.forEach((a, i) => lb.slice(i + 1).forEach((b) => { if (hit(a.b, b.b)) problems.push(`label "${a.l.text}" overlaps label "${b.l.text}"`); }));
  for (const { l, b } of lb) {
    for (const s of g.spots) if (hit(b, spotBox(s))) problems.push(`label "${l.text}" overlaps the key/hole at ${s.x},${s.y}`);
    for (const t of g.body) if (hit(b, { x0: t.x0, x1: t.x1, y0: t.top, y1: t.bottom })) problems.push(`label "${l.text}" overlaps the tube`);
    if (b.y0 < 0 || b.y1 > g.height || b.x0 < 0 || b.x1 > 1000) problems.push(`label "${l.text}" is cut off`);
  }
  g.spots.forEach((a, i) => g.spots.slice(i + 1).forEach((b) => { if (hit(spotBox(a), spotBox(b), 1)) problems.push(`keys/holes at ${a.x} and ${b.x} overlap`); }));
  // Touch targets shouldn't steal each other's middle.
  g.spots.forEach((a, i) => g.spots.slice(i + 1).forEach((b) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < Math.max(a.hit, b.hit)) problems.push(`touch areas at ${a.x} and ${b.x} reach each other's centre`);
  }));
  return problems;
}

describe('flute drawings have no overlaps', () => {
  for (const [name, g] of Object.entries({ concert: CONCERT, bansuri: BANSURI, recorder: RECORDER, whistle: WHISTLE })) {
    it(`${name} on a wide screen`, () => expect(overlaps(g, false)).toEqual([]));
    it(`${name} on a phone`, () => expect(overlaps(g, true)).toEqual([]));
  }
});
