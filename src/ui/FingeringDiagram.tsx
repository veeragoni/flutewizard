import type { Fingering, Instrument } from '../instruments';
import type { ConcertKey } from '../instruments/types';

/**
 * Compact vertical fingering chart (mouthpiece at the top), like the chord boxes on a guitar
 * chord chart. Filled = covered/pressed, half = half-holed, ring = open.
 */
export function FingeringDiagram({ inst, fingering, size = 1 }: { inst: Instrument; fingering: Fingering | null; size?: number }) {
  if (!fingering) {
    return <div class="fd-missing" style={{ height: 110 * size }}>no fingering</div>;
  }
  if (fingering.kind === 'keys') return <ConcertDiagram keys={fingering.f.keys} size={size} />;
  const holes = fingering.f.holes;
  const thumb = inst.hasThumbHole;
  const front = thumb ? holes.slice(1) : holes;
  const gapAfter = inst.id === 'recorder' ? 3 : inst.topHand;
  const step = 15;
  const h = 18 + front.length * step + 10 + 8;
  return (
    <svg class="fd" width={34 * size} height={h * size} viewBox={`0 0 34 ${h}`}>
      <rect x="12" y="2" width="10" height={h - 4} rx="5" class="fd-body" />
      {thumb && <Dot cx={5} cy={14} r={4} state={holes[0]} />}
      {front.map((s, i) => (
        <Dot cx={17} cy={14 + i * step + (i >= gapAfter ? 8 : 0)} r={5.2} state={s} />
      ))}
      {fingering.f.register > 1 && (
        <text x="31" y="10" class="fd-reg">{fingering.f.register === 2 ? '+' : '++'}</text>
      )}
    </svg>
  );
}

function Dot({ cx, cy, r, state }: { cx: number; cy: number; r: number; state: number }) {
  if (state === 0.5) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} class="fd-open" />
        <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r} Z`} class="fd-closed" />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={r} class={state ? 'fd-closed' : 'fd-open'} />;
}

const CONCERT_LAYOUT: { k: ConcertKey; x: number; y: number; r: number }[] = [
  { k: 'T', x: 6, y: 16, r: 4 },
  { k: 'Tb', x: 6, y: 26, r: 3 },
  { k: 'L1', x: 20, y: 14, r: 5.5 },
  { k: 'L2', x: 20, y: 28, r: 5.5 },
  { k: 'L3', x: 20, y: 42, r: 5.5 },
  { k: 'Gs', x: 32, y: 46, r: 3 },
  { k: 'Tr1', x: 32, y: 60, r: 2.6 },
  { k: 'Tr2', x: 32, y: 68, r: 2.6 },
  { k: 'R1', x: 20, y: 64, r: 5.5 },
  { k: 'R2', x: 20, y: 78, r: 5.5 },
  { k: 'R3', x: 20, y: 92, r: 5.5 },
  { k: 'Eb', x: 32, y: 98, r: 3 },
  { k: 'Cs', x: 14, y: 108, r: 3 },
  { k: 'C', x: 24, y: 108, r: 3 },
];

function ConcertDiagram({ keys, size }: { keys: ConcertKey[]; size: number }) {
  const on = new Set(keys);
  return (
    <svg class="fd" width={38 * size} height={116 * size} viewBox="0 0 38 116">
      <rect x="15" y="4" width="10" height="96" rx="5" class="fd-body" />
      {CONCERT_LAYOUT.map(({ k, x, y, r }) => (
        <circle cx={x} cy={y} r={r} class={on.has(k) ? 'fd-closed' : 'fd-open'}>
          <title>{k}</title>
        </circle>
      ))}
    </svg>
  );
}
