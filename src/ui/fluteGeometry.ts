import type { ConcertKey } from '../instruments/types';

/**
 * Where everything sits on the big flute drawings (viewBox units, 1000 wide). Kept apart from the
 * drawing code so a test can check that no label overlaps another label, a key, a hole or the tube.
 */

export interface Label {
  text: string;
  x: number;
  /** Baseline. */
  y: number;
  size: number;
  /** Hidden on small screens, where labels are drawn larger. */
  minor?: boolean;
}

export interface Spot {
  x: number;
  y: number;
  /** Radius for round holes and cups; half-size for the others. */
  r: number;
  w?: number;
  h?: number;
  shape: 'hole' | 'cup' | 'trill' | 'plate' | 'paddle' | 'roller';
  /** A second, smaller hole beside this one (recorder double holes). */
  pair?: { x: number; y: number; r: number };
  /** How far the touch target reaches. */
  hit: number;
  label?: Label;
}

export interface Body {
  /** Tube extents, for the overlap check. */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export interface FluteGeometry {
  height: number;
  cy: number;
  body: Body[];
  spots: Spot[];
  /** Labels that don't belong to a hole or key ("blow", "thumb"). */
  extra: Label[];
}

const L = (text: string, x: number, y: number, size = 13, minor?: boolean): Label => ({ text, x, y, size, minor });

function holeRow(xs: number[], cy: number, r: number, labelY: number, first = 1): Spot[] {
  return xs.map((x, i) => ({ x, y: cy, r, shape: 'hole', hit: Math.min(r + 14, 26), label: L(String(i + first), x, labelY) }));
}

/* ── Bansuri: closed end on the left past the blowing hole, six holes in two groups ── */
const B_CY = 100, B_R = 22;
export const BANSURI: FluteGeometry = {
  height: 190,
  cy: B_CY,
  body: [{ x0: 40, x1: 958, top: B_CY - B_R, bottom: B_CY + B_R }],
  spots: holeRow([466, 524, 582, 682, 740, 798], B_CY, 10, B_CY + B_R + 26),
  extra: [L('blow', 170, B_CY + B_R + 26)],
};

/* ── Tin whistle: plastic head with windway and window, metal tube ── */
const W_CY = 100, W_R = 16;
export const WHISTLE: FluteGeometry = {
  height: 190,
  cy: W_CY,
  body: [
    { x0: 40, x1: 300, top: W_CY - 21, bottom: W_CY + 21 },
    { x0: 300, x1: 906, top: W_CY - W_R, bottom: W_CY + W_R },
  ],
  spots: holeRow([452, 508, 564, 664, 720, 776], W_CY, 8.5, W_CY + 21 + 26),
  extra: [L('blow', 52, W_CY + 21 + 26)],
};

/* ── Recorder (Baroque soprano): thumb hole on the back, double holes 6 and 7 ── */
const R_CY = 116, R_R = 21;
const R_LABEL = R_CY + 52; // below the flared foot too
const recorderHoles = holeRow([402, 454, 506, 588, 640], R_CY, 7.5, R_LABEL);
export const RECORDER: FluteGeometry = {
  height: 214,
  cy: R_CY,
  body: [
    { x0: 34, x1: 300, top: R_CY - 25, bottom: R_CY + 25 },
    { x0: 300, x1: 738, top: R_CY - R_R, bottom: R_CY + R_R },
    { x0: 738, x1: 890, top: R_CY - 30, bottom: R_CY + 30 },
  ],
  spots: [
    // Thumb hole: on the back, drawn above the tube where the thumb sits.
    { x: 352, y: R_CY - 58, r: 7.5, shape: 'hole', hit: 22, label: L('thumb', 352, R_CY - 80, 12) },
    ...recorderHoles,
    { x: 690, y: R_CY, r: 6, shape: 'hole', hit: 22, pair: { x: 703, y: R_CY, r: 4 }, label: L('6', 696, R_LABEL) },
    { x: 796, y: R_CY, r: 6, shape: 'hole', hit: 22, pair: { x: 809, y: R_CY, r: 4 }, label: L('7', 802, R_LABEL) },
  ],
  extra: [L('(on the back)', 352, R_CY - 97, 11, true), L('blow', 52, R_LABEL)],
};

/* ── Concert flute (Boehm system) ── */
const C_CY = 112, C_R = 13;
const cup = (x: number, text: string): Spot => ({ x, y: C_CY, r: 13, shape: 'cup', hit: 26, label: L(text, x, C_CY - C_R - 20, 12) });
const lower = C_CY + C_R + 24; // centre line of the keys worked by thumb and little fingers
const lowLabel = lower + 32;
export const CONCERT_KEYS_AT: Record<ConcertKey, Spot> = {
  L1: cup(392, 'L1'),
  L2: cup(450, 'L2'),
  L3: cup(508, 'L3'),
  R1: cup(646, 'R1'),
  R2: cup(704, 'R2'),
  R3: cup(762, 'R3'),
  Tr1: { x: 566, y: C_CY - C_R - 34, r: 7, shape: 'trill', hit: 15, label: L('Tr1', 566, C_CY - C_R - 55, 11, true) },
  Tr2: { x: 598, y: C_CY - C_R - 34, r: 7, shape: 'trill', hit: 15, label: L('Tr2', 598, C_CY - C_R - 55, 11, true) },
  T: { x: 374, y: lower, r: 7, w: 32, h: 13, shape: 'plate', hit: 19, label: L('B', 374, lowLabel, 12) },
  Tb: { x: 414, y: lower, r: 6, w: 20, h: 11, shape: 'paddle', hit: 19, label: L('B♭', 414, lowLabel, 12) },
  Gs: { x: 536, y: lower, r: 6, w: 26, h: 12, shape: 'paddle', hit: 22, label: L('G♯', 536, lowLabel, 12) },
  Eb: { x: 800, y: lower, r: 6, w: 26, h: 12, shape: 'paddle', hit: 22, label: L('E♭', 800, lowLabel, 12) },
  Cs: { x: 874, y: lower, r: 6, w: 28, h: 11, shape: 'roller', hit: 22, label: L('C♯', 874, lowLabel, 12) },
  C: { x: 922, y: lower, r: 6, w: 28, h: 11, shape: 'roller', hit: 22, label: L('C', 922, lowLabel, 12) },
};
export const CONCERT: FluteGeometry = {
  height: 222,
  cy: C_CY,
  body: [
    { x0: 26, x1: 302, top: C_CY - 12, bottom: C_CY + 12 },
    { x0: 302, x1: 808, top: C_CY - C_R, bottom: C_CY + C_R },
    { x0: 808, x1: 966, top: C_CY - 12.5, bottom: C_CY + 12.5 },
  ],
  spots: Object.values(CONCERT_KEYS_AT),
  extra: [L('blow', 150, C_CY + 46), L('thumb', 394, lowLabel + 17, 11, true)],
};

/** Width of a label in viewBox units (Inter, roughly). */
export function labelBox(l: Label, scale = 1) {
  const size = l.size * scale;
  const w = [...l.text].length * size * 0.6;
  return { x0: l.x - w / 2, x1: l.x + w / 2, y0: l.y - size * 0.78, y1: l.y + size * 0.22 };
}

/** Bounding box of a hole or key as drawn (including the finger ring around it). */
export function spotBox(s: Spot) {
  const ring = 5;
  if (s.w && s.h) return { x0: s.x - s.w / 2 - 2, x1: s.x + s.w / 2 + 2, y0: s.y - s.h / 2 - 2, y1: s.y + s.h / 2 + 2 };
  const right = s.pair ? Math.max(s.x + s.r, s.pair.x + s.pair.r) : s.x + s.r;
  return { x0: s.x - s.r - ring, x1: right + ring, y0: s.y - s.r - ring, y1: s.y + s.r + ring };
}
