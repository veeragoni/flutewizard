import type { Fingering, Instrument } from '../instruments';
import type { ConcertKey } from '../instruments/types';

/**
 * Large drawing of the selected flute with its holes/keys showing the current fingering.
 * In Fingers mode the holes are touchable.
 */

interface Props {
  inst: Instrument;
  fingering: Fingering | null;
  /** What the player is physically holding in Fingers mode (overrides `fingering` for display). */
  held?: { holes?: number[]; keys?: string[] } | null;
  interactive?: boolean;
  onHole?: (index: number, state: 0 | 0.5 | 1) => void;
  onKey?: (key: ConcertKey, down: boolean) => void;
  sounding?: boolean;
}

export function FluteView(p: Props) {
  switch (p.inst.id) {
    case 'concert': return <ConcertFlute {...p} />;
    case 'bansuri': return <HoleFlute {...p} variant="bansuri" />;
    case 'recorder': return <HoleFlute {...p} variant="recorder" />;
    case 'whistle': return <HoleFlute {...p} variant="whistle" />;
  }
}

function holeStates(p: Props, n: number): number[] {
  if (p.held?.holes) return p.held.holes;
  if (p.fingering?.kind === 'holes') return p.fingering.f.holes;
  return new Array(n).fill(-1); // unknown: draw as neutral
}

function Hole(props: { cx: number; cy: number; r: number; state: number; label?: string; double?: boolean; onDown?: (e: PointerEvent) => void }) {
  const { cx, cy, r, state } = props;
  const id = `half-${cx}-${cy}`;
  const unknown = state < 0;
  return (
    <g class={'hole' + (props.onDown ? ' touch' : '')} onPointerDown={props.onDown ? (e) => props.onDown!(e as unknown as PointerEvent) : undefined}>
      <circle cx={cx} cy={cy} r={r + 7} fill="transparent" />
      <circle cx={cx} cy={cy} r={r} class="hole-pit" />
      {props.double && <circle cx={cx + r * 0.25} cy={cy} r={r * 0.45} class="hole-pit" />}
      {state === 1 && <circle cx={cx} cy={cy} r={r + 3.5} class="finger" />}
      {state === 0.5 && (
        <>
          <clipPath id={id}><rect x={cx - r - 5} y={cy - r - 5} width={r + 5} height={(r + 5) * 2} /></clipPath>
          <circle cx={cx} cy={cy} r={r + 3.5} class="finger" clip-path={`url(#${id})`} />
          <circle cx={cx} cy={cy} r={r + 3.5} class="finger-half-ring" />
        </>
      )}
      {!unknown && state === 0 && <circle cx={cx} cy={cy} r={r + 3.5} class="open-ring" />}
      {props.label && <text x={cx} y={cy + r + 22} class="hole-label">{props.label}</text>}
    </g>
  );
}

function cycle(state: number, e: PointerEvent): 0 | 0.5 | 1 {
  if (e.button === 2 || e.shiftKey) return state === 0.5 ? 0 : 0.5;
  return state >= 0.5 ? 0 : 1;
}

function HoleFlute(p: Props & { variant: 'bansuri' | 'recorder' | 'whistle' }) {
  const v = p.variant;
  const n = p.inst.holeCount;
  const states = holeStates(p, n);
  const H = 220;
  const cy = 110;
  // Hole x positions (from the mouthpiece end) and radii, per instrument.
  const layout: { x: number; r: number; double?: boolean; label: string }[] =
    v === 'bansuri'
      ? [470, 528, 586, 680, 738, 796].map((x, i) => ({ x, r: 10.5, label: String(i + 1) }))
      : v === 'whistle'
        ? [430, 488, 546, 638, 696, 754].map((x, i) => ({ x, r: 9, label: String(i + 1) }))
        : [
            { x: 330, r: 8, label: 'thumb' },
            ...[392, 446, 500, 574, 628, 682].map((x, i) => ({ x, r: 8, label: String(i + 1) })),
            { x: 740, r: 7, label: '7' },
          ].map((h, i) => ({ ...h, double: i === 6 || i === 7 }));

  const onDown = (i: number) => (e: PointerEvent) => {
    if (!p.interactive || !p.onHole) return;
    e.preventDefault();
    p.onHole(i, cycle(states[i] ?? 0, e));
  };

  return (
    <svg viewBox={`0 0 1000 ${H}`} class={`flute-svg ${v}` + (p.sounding ? ' sounding' : '')} onContextMenu={(e) => p.interactive && e.preventDefault()}>
      <defs>
        <linearGradient id="bamboo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f3d9a0" />
          <stop offset="0.35" stop-color="#d9b06a" />
          <stop offset="0.75" stop-color="#a77a3c" />
          <stop offset="1" stop-color="#6e4c22" />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d9a77a" />
          <stop offset="0.4" stop-color="#b37a4c" />
          <stop offset="1" stop-color="#6b4024" />
        </linearGradient>
        <linearGradient id="nickel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f2f4f6" />
          <stop offset="0.4" stop-color="#b9c0c7" />
          <stop offset="0.7" stop-color="#8b939b" />
          <stop offset="1" stop-color="#5d646b" />
        </linearGradient>
        <linearGradient id="fipple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3f6e52" />
          <stop offset="1" stop-color="#1c3526" />
        </linearGradient>
        <radialGradient id="fingerGrad" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stop-color="#ffe3a3" />
          <stop offset="1" stop-color="#e3a43a" />
        </radialGradient>
      </defs>

      {v === 'bansuri' && (
        <g>
          <rect x="40" y={cy - 24} width="920" height="48" rx="22" fill="url(#bamboo)" />
          {/* Natural node near the top and silk bindings */}
          <rect x="40" y={cy - 24} width="40" height="48" rx="20" fill="#8a5f2c" opacity="0.6" />
          {[96, 112, 300, 316, 870, 886, 920].map((x) => <rect x={x} y={cy - 25} width="9" height="50" rx="2" fill="#5b2a1a" opacity="0.85" />)}
          <ellipse cx="170" cy={cy} rx="13" ry="10" class="hole-pit" />
          <text x="170" y={cy + 44} class="hole-label">blow</text>
          <path d={`M60 ${cy - 16} L940 ${cy - 16}`} stroke="#fff6dd" stroke-opacity="0.35" stroke-width="3" />
        </g>
      )}
      {v === 'whistle' && (
        <g>
          <path d={`M40 ${cy - 20} L250 ${cy - 22} L250 ${cy + 22} L40 ${cy + 16} Q28 ${cy} 40 ${cy - 20} Z`} fill="url(#fipple)" />
          <rect x="248" y={cy - 19} width="620" height="38" rx="5" fill="url(#nickel)" />
          <rect x="190" y={cy - 9} width="34" height="18" rx="2" fill="#0d1a12" />
          <path d={`M190 ${cy - 9} L176 ${cy} L190 ${cy + 9} Z`} fill="#0d1a12" />
          <path d={`M260 ${cy - 12} L860 ${cy - 12}`} stroke="#fff" stroke-opacity="0.45" stroke-width="3" />
        </g>
      )}
      {v === 'recorder' && (
        <g>
          <path d={`M30 ${cy - 10} Q40 ${cy - 26} 120 ${cy - 26} L290 ${cy - 26} L290 ${cy + 26} L120 ${cy + 26} Q60 ${cy + 26} 30 ${cy + 8} Z`} fill="url(#wood)" />
          <rect x="285" y={cy - 22} width="420" height="44" rx="6" fill="url(#wood)" />
          <path d={`M700 ${cy - 22} L790 ${cy - 26} Q830 ${cy - 30} 840 ${cy - 34} L840 ${cy + 34} Q830 ${cy + 30} 790 ${cy + 26} L700 ${cy + 22} Z`} fill="url(#wood)" />
          {[285, 700].map((x) => <rect x={x - 3} y={cy - 27} width="8" height="54" rx="3" fill="#5b3418" />)}
          <rect x="150" y={cy - 12} width="30" height="16" rx="2" fill="#2b170a" />
          <path d={`M50 ${cy - 14} L840 ${cy - 14}`} stroke="#ffe4c4" stroke-opacity="0.3" stroke-width="3" />
          <text x="330" y={cy - 40} class="hole-label">back</text>
        </g>
      )}

      {layout.map((h, i) => (
        <Hole
          cx={h.x}
          cy={v === 'recorder' && i === 0 ? cy - 2 : cy}
          r={h.r}
          state={states[i] ?? -1}
          label={h.label}
          double={h.double}
          onDown={p.interactive ? onDown(i) : undefined}
        />
      ))}
    </svg>
  );
}

const KEY_POS: Record<ConcertKey, { x: number; y: number; r: number; label: string; shape?: 'lever' | 'roller' }> = {
  T: { x: 352, y: 146, r: 9, label: 'B (thumb)' },
  Tb: { x: 376, y: 146, r: 7, label: 'B♭ thumb' },
  L1: { x: 380, y: 100, r: 13, label: 'L1' },
  L2: { x: 448, y: 100, r: 13, label: 'L2' },
  L3: { x: 500, y: 100, r: 13, label: 'L3' },
  Gs: { x: 534, y: 132, r: 8, label: 'G♯', shape: 'lever' },
  R1: { x: 620, y: 100, r: 13, label: 'R1' },
  R2: { x: 672, y: 100, r: 13, label: 'R2' },
  R3: { x: 724, y: 100, r: 13, label: 'R3' },
  Tr1: { x: 572, y: 70, r: 6, label: 'Tr 1' },
  Tr2: { x: 596, y: 70, r: 6, label: 'Tr 2' },
  Eb: { x: 762, y: 132, r: 8, label: 'E♭', shape: 'lever' },
  Cs: { x: 846, y: 134, r: 8, label: 'C♯', shape: 'roller' },
  C: { x: 870, y: 134, r: 8, label: 'C', shape: 'roller' },
};

function ConcertFlute(p: Props) {
  const pressed = new Set<string>(p.held?.keys ?? (p.fingering?.kind === 'keys' ? p.fingering.f.keys : []));
  const known = !!p.held?.keys || p.fingering?.kind === 'keys';
  const cy = 100;
  return (
    <svg viewBox="0 0 1000 200" class={'flute-svg concert' + (p.sounding ? ' sounding' : '')}>
      <defs>
        <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.3" stop-color="#d7dde3" />
          <stop offset="0.65" stop-color="#9aa3ad" />
          <stop offset="1" stop-color="#5f6872" />
        </linearGradient>
        <radialGradient id="padGrad" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#a8b1bb" />
        </radialGradient>
        <radialGradient id="fingerGrad" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stop-color="#ffe3a3" />
          <stop offset="1" stop-color="#e3a43a" />
        </radialGradient>
      </defs>
      {/* Head joint, body and foot joint */}
      <rect x="40" y={cy - 13} width="250" height="26" rx="6" fill="url(#silver)" />
      <rect x="286" y={cy - 14} width="520" height="28" rx="3" fill="url(#silver)" />
      <rect x="802" y={cy - 13} width="150" height="26" rx="4" fill="url(#silver)" />
      {[288, 804].map((x) => <rect x={x - 3} y={cy - 16} width="7" height="32" rx="2" fill="#c9d0d7" stroke="#6b737c" stroke-width="0.6" />)}
      {/* Lip plate */}
      <path d={`M120 ${cy - 22} Q150 ${cy - 26} 180 ${cy - 22} L180 ${cy + 4} Q150 ${cy + 8} 120 ${cy + 4} Z`} fill="url(#silver)" stroke="#6b737c" stroke-width="0.8" />
      <ellipse cx="150" cy={cy - 9} rx="10" ry="6" fill="#20262c" />
      <text x="150" y={cy + 40} class="hole-label">blow</text>
      {/* Key rod */}
      <rect x="330" y={cy + 14} width="580" height="3" fill="#7d868f" />

      {(Object.keys(KEY_POS) as ConcertKey[]).map((k) => {
        const pos = KEY_POS[k];
        const on = pressed.has(k);
        const down = (e: PointerEvent) => {
          if (!p.interactive || !p.onKey) return;
          e.preventDefault();
          p.onKey(k, !on);
        };
        return (
          <g class={'hole' + (p.interactive ? ' touch' : '')} onPointerDown={(e) => down(e as unknown as PointerEvent)}>
            <circle cx={pos.x} cy={pos.y} r={pos.r + 8} fill="transparent" />
            {pos.shape === 'lever' || pos.shape === 'roller' ? (
              <rect x={pos.x - pos.r * 1.3} y={pos.y - pos.r * 0.8} width={pos.r * 2.6} height={pos.r * 1.6} rx={pos.r * 0.8} fill="url(#padGrad)" stroke="#68717a" />
            ) : (
              <circle cx={pos.x} cy={pos.y} r={pos.r} fill="url(#padGrad)" stroke="#68717a" stroke-width="1" />
            )}
            {(k === 'L1' || k === 'L2' || k === 'L3' || k === 'R1' || k === 'R2' || k === 'R3') && (
              <circle cx={pos.x} cy={pos.y} r={pos.r * 0.35} fill="#2a3036" opacity={on ? 0 : 0.85} />
            )}
            {on && <circle cx={pos.x} cy={pos.y} r={pos.r + 3} class="finger" />}
            {!on && known && <circle cx={pos.x} cy={pos.y} r={pos.r + 3} class="open-ring" />}
            <text x={pos.x} y={pos.y + (pos.y > cy ? pos.r + 18 : -pos.r - 8)} class="hole-label small">{pos.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
