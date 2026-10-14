import type { ComponentChildren } from 'preact';
import type { Fingering, Instrument } from '../instruments';
import type { ConcertKey } from '../instruments/types';
import { BANSURI, CONCERT, CONCERT_KEYS_AT, RECORDER, WHISTLE, type Label, type Spot } from './fluteGeometry';

/**
 * Large drawing of the selected flute with its holes/keys showing the current fingering.
 * In Fingers mode the holes are touchable. Positions live in fluteGeometry.ts, where a test checks
 * that nothing overlaps; this file is only the look.
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
    case 'bansuri': return <Bansuri {...p} />;
    case 'recorder': return <Recorder {...p} />;
    case 'whistle': return <Whistle {...p} />;
  }
}

/* ───────────────────────── Shared pieces ───────────────────────── */

type Stops = [number, string][];
const vgrad = (id: string, stops: Stops) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    {stops.map(([o, c]) => <stop offset={o} stop-color={c} />)}
  </linearGradient>
);

/** Materials, lit from above: dark rim, bright highlight a third of the way down, reflected light at the bottom. */
const MATERIALS: Record<string, Stops> = {
  bamboo: [[0, '#6b461c'], [0.07, '#b4843f'], [0.2, '#e9cd92'], [0.3, '#f8e7ba'], [0.45, '#e0bb76'], [0.7, '#c19149'], [0.88, '#8c5f27'], [1, '#5b3a14']],
  wood: [[0, '#4f2a12'], [0.08, '#8f5630'], [0.22, '#cf9462'], [0.32, '#e8b888'], [0.5, '#c4865a'], [0.78, '#8f552c'], [0.92, '#66371a'], [1, '#43230f']],
  plastic: [[0, '#0c1d14'], [0.12, '#285338'], [0.28, '#4f8a66'], [0.36, '#6aa580'], [0.5, '#3a7150'], [0.8, '#1d3f2b'], [1, '#0a1710']],
  metal: [[0, '#363b41'], [0.1, '#8a929b'], [0.26, '#e9edf1'], [0.33, '#ffffff'], [0.47, '#c6ccd2'], [0.74, '#87909a'], [0.9, '#585f67'], [1, '#33383e']],
  silver: [[0, '#454c54'], [0.1, '#a2aab3'], [0.27, '#f2f4f7'], [0.34, '#ffffff'], [0.5, '#d3d8de'], [0.76, '#98a0a9'], [0.92, '#69717a'], [1, '#41474e']],
  shade: [[0, 'rgba(0,0,0,0.5)'], [0.28, 'rgba(255,255,255,0.18)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']],
  bevel: [[0, 'rgba(0,0,0,0.55)'], [0.5, 'rgba(0,0,0,0.15)'], [1, 'rgba(255,255,255,0.4)']],
};

function Defs({ children }: { children?: ComponentChildren }) {
  return (
    <defs>
      {Object.entries(MATERIALS).map(([id, stops]) => vgrad(`fv-${id}`, stops))}
      <radialGradient id="fv-pit" cx="0.5" cy="0.4" r="0.62">
        <stop offset="0" stop-color="#000" />
        <stop offset="0.72" stop-color="#0d0906" />
        <stop offset="1" stop-color="#2c2015" />
      </radialGradient>
      <radialGradient id="fv-pit-metal" cx="0.5" cy="0.4" r="0.62">
        <stop offset="0" stop-color="#000" />
        <stop offset="0.72" stop-color="#0c0e11" />
        <stop offset="1" stop-color="#3a4149" />
      </radialGradient>
      <radialGradient id="fv-pad" cx="0.38" cy="0.32" r="0.78">
        <stop offset="0" stop-color="#fff2cc" />
        <stop offset="0.45" stop-color="#f6c766" />
        <stop offset="1" stop-color="#c3802a" />
      </radialGradient>
      <radialGradient id="fv-cup" cx="0.4" cy="0.34" r="0.72">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.5" stop-color="#dde2e7" />
        <stop offset="1" stop-color="#868f99" />
      </radialGradient>
      <linearGradient id="fv-ramp" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity="0.9" />
        <stop offset="1" stop-color="#fff" stop-opacity="0.25" />
      </linearGradient>
      <filter id="fv-blur" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id="fv-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      {children}
    </defs>
  );
}

/** Soft shadow under the instrument. */
const Shadow = ({ x0, x1, y }: { x0: number; x1: number; y: number }) => (
  <ellipse cx={(x0 + x1) / 2} cy={y} rx={(x1 - x0) / 2} ry="6" fill="#000" opacity="0.55" filter="url(#fv-blur)" />
);

function Text({ l }: { l: Label }) {
  return <text x={l.x} y={l.y} class={'hole-label' + (l.minor ? ' minor' : '')} style={{ '--fs': l.size }}>{l.text}</text>;
}

/** Faint fibres along a bamboo or wood body (deterministic, so the drawing doesn't change). */
function Grain({ x0, x1, cy, r, wavy, color }: { x0: number; x1: number; cy: number; r: number; wavy?: boolean; color: string }) {
  const lines: preact.JSX.Element[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 16; i++) {
    const y = cy - r * 0.85 + rnd() * r * 1.7;
    const a = x0 + rnd() * (x1 - x0) * 0.3;
    const b = x1 - rnd() * (x1 - x0) * 0.3;
    const d = wavy
      ? `M${a} ${y} C${a + (b - a) * 0.3} ${y - 3 + rnd() * 6} ${a + (b - a) * 0.6} ${y - 3 + rnd() * 6} ${b} ${y}`
      : `M${a} ${y} L${b} ${y}`;
    lines.push(<path d={d} stroke={color} stroke-width={0.6 + rnd() * 0.9} stroke-opacity={0.08 + rnd() * 0.12} fill="none" />);
  }
  return <g>{lines}</g>;
}

/** A specular streak along the top of a tube. */
const Shine = ({ x0, x1, y, opacity = 0.4 }: { x0: number; x1: number; y: number; opacity?: number }) => (
  <>
    <path d={`M${x0} ${y} L${x1} ${y}`} stroke="#fff" stroke-opacity={opacity * 0.35} stroke-width="5" stroke-linecap="round" />
    <path d={`M${x0 + 6} ${y} L${x1 - 6} ${y}`} stroke="#fff" stroke-opacity={opacity} stroke-width="1.6" stroke-linecap="round" />
  </>
);

function cycle(state: number, e: PointerEvent): 0 | 0.5 | 1 {
  if (e.button === 2 || e.shiftKey) return state === 0.5 ? 0 : 0.5;
  return state >= 0.5 ? 0 : 1;
}

function holeStates(p: Props, n: number): number[] {
  if (p.held?.holes) return p.held.holes;
  if (p.fingering?.kind === 'holes') return p.fingering.f.holes;
  return new Array(n).fill(-1); // unknown: draw as neutral
}

/** A finger hole cut into the body, with what the finger is doing over it. */
function ToneHole({ s, state, metal, onDown }: { s: Spot; state: number; metal?: boolean; onDown?: (e: PointerEvent) => void }) {
  const pit = metal ? 'url(#fv-pit-metal)' : 'url(#fv-pit)';
  const clip = `fv-half-${Math.round(s.x)}-${Math.round(s.y)}`;
  const pad = s.r + 4;
  const pair = s.pair;
  return (
    <g class={'hole' + (onDown ? ' touch' : '')} onPointerDown={onDown ? (e) => onDown(e as unknown as PointerEvent) : undefined}>
      <circle cx={s.x} cy={s.y} r={s.hit} fill="transparent" />
      {[s, ...(pair ? [pair] : [])].map((h) => (
        <>
          <circle cx={h.x} cy={h.y} r={h.r + 2.2} fill="url(#fv-bevel)" />
          <circle cx={h.x} cy={h.y} r={h.r} fill={pit} />
          <ellipse cx={h.x} cy={h.y + h.r * 0.5} rx={h.r * 0.55} ry={h.r * 0.2} fill="#fff" opacity="0.08" />
        </>
      ))}
      {state === 1 && (
        <g filter="url(#fv-glow)">
          <circle cx={s.x} cy={s.y} r={pad} class="finger" />
          {pair && <circle cx={pair.x} cy={pair.y} r={pair.r + 3.4} class="finger" />}
        </g>
      )}
      {state === 0.5 && (
        pair ? (
          // Half on a double hole: the larger hole covered, the small one open.
          <g filter="url(#fv-glow)"><circle cx={s.x} cy={s.y} r={pad} class="finger" /></g>
        ) : (
          <>
            <clipPath id={clip}><rect x={s.x - pad - 2} y={s.y - pad - 2} width={pad + 2} height={(pad + 2) * 2} /></clipPath>
            <g filter="url(#fv-glow)"><circle cx={s.x} cy={s.y} r={pad} class="finger" clip-path={`url(#${clip})`} /></g>
            <circle cx={s.x} cy={s.y} r={pad} class="finger-half-ring" />
          </>
        )
      )}
      {state === 0 && <circle cx={s.x} cy={s.y} r={pad + 0.5} class="open-ring" />}
      {s.label && <Text l={s.label} />}
    </g>
  );
}

function HoleSet({ p, spots, metal, offset = 0 }: { p: Props; spots: Spot[]; metal?: boolean; offset?: number }) {
  const states = holeStates(p, p.inst.holeCount);
  const onDown = (i: number) => (e: PointerEvent) => {
    if (!p.interactive || !p.onHole) return;
    e.preventDefault();
    p.onHole(i, cycle(states[i] ?? 0, e));
  };
  return <>{spots.map((s, i) => <ToneHole s={s} state={states[i + offset] ?? -1} metal={metal} onDown={p.interactive ? onDown(i + offset) : undefined} />)}</>;
}

function Frame({ p, kind, height, children }: { p: Props; kind: string; height: number; children: ComponentChildren }) {
  return (
    <svg
      viewBox={`0 0 1000 ${height}`}
      class={`flute-svg ${kind}` + (p.sounding ? ' sounding' : '')}
      role="img"
      aria-label={`${p.inst.name} fingering`}
      onContextMenu={(e) => p.interactive && e.preventDefault()}
    >
      {children}
    </svg>
  );
}

/** Silk thread wrapped round the bamboo: alternating maroon and gold turns, shaded as a cylinder. */
function Binding({ x, turns, cy, r }: { x: number; turns: number; cy: number; r: number }) {
  return (
    <g>
      {Array.from({ length: turns }, (_, k) => (
        <rect x={x + k * 3.1} y={cy - r - 1} width="2.7" height={2 * r + 2} rx="1" fill={k % 4 === 1 || k % 4 === 2 ? '#c9952f' : '#7a1c22'} />
      ))}
      <rect x={x} y={cy - r - 1} width={turns * 3.1} height={2 * r + 2} fill="url(#fv-shade)" />
    </g>
  );
}

/* ───────────────────────── Bansuri ───────────────────────── */

function Bansuri(p: Props) {
  const g = BANSURI;
  const { cy } = g;
  const r = 22;
  const x0 = 46, x1 = 950;
  return (
    <Frame p={p} kind="bansuri" height={g.height}>
      <Defs>
        <clipPath id="fv-bansuri-clip"><rect x={x0} y={cy - r} width={x1 - x0} height={2 * r} /></clipPath>
      </Defs>
      <Shadow x0={x0 + 20} x1={x1 - 10} y={cy + r + 12} />
      <rect x={x0} y={cy - r} width={x1 - x0} height={2 * r} fill="url(#fv-bamboo)" />
      <g clip-path="url(#fv-bansuri-clip)">
        <Grain x0={x0} x1={x1} cy={cy} r={r} color="#5a3a14" />
        {/* Natural nodes: a slight swelling with a darker ring. */}
        {[330, 864].map((x) => (
          <g>
            <rect x={x - 4} y={cy - r} width="8" height={2 * r} fill="#6b461c" opacity="0.45" />
            <path d={`M${x + 4.5} ${cy - r} L${x + 4.5} ${cy + r}`} stroke="#fff3d0" stroke-opacity="0.35" stroke-width="1.4" />
          </g>
        ))}
      </g>
      {/* Closed end (left) and the open end showing the bore (right). */}
      <ellipse cx={x0} cy={cy} rx="7" ry={r} fill="#8c5f27" />
      <ellipse cx={x0 - 1} cy={cy} rx="5" ry={r - 4} fill="#b4843f" opacity="0.7" />
      <ellipse cx={x1} cy={cy} rx="7" ry={r} fill="#d8b46e" />
      <ellipse cx={x1} cy={cy} rx="4.5" ry={r - 6} fill="url(#fv-pit)" />
      <Binding x={64} turns={9} cy={cy} r={r} />
      <Binding x={232} turns={7} cy={cy} r={r} />
      <Binding x={884} turns={10} cy={cy} r={r} />
      <Shine x0={x0 + 10} x1={x1 - 10} y={cy - r * 0.48} opacity={0.45} />
      {/* Blowing hole */}
      <ellipse cx="170" cy={cy} rx="14.2" ry="11.6" fill="url(#fv-bevel)" />
      <ellipse cx="170" cy={cy} rx="12" ry="9.6" fill="url(#fv-pit)" />
      {g.extra.map((l) => <Text l={l} />)}
      <HoleSet p={p} spots={g.spots} />
    </Frame>
  );
}

/* ───────────────────────── Tin whistle ───────────────────────── */

function Whistle(p: Props) {
  const g = WHISTLE;
  const { cy } = g;
  const hr = 21, tr = 16;
  return (
    <Frame p={p} kind="whistle" height={g.height}>
      <Defs />
      <Shadow x0={70} x1={900} y={cy + hr + 10} />
      {/* Metal tube with its open end. */}
      <rect x="298" y={cy - tr} width="604" height={2 * tr} fill="url(#fv-metal)" />
      {[0.3, 0.55, 0.72].map((f) => <path d={`M320 ${cy - tr + 2 * tr * f} L890 ${cy - tr + 2 * tr * f}`} stroke="#fff" stroke-opacity="0.07" stroke-width="0.8" />)}
      <ellipse cx="902" cy={cy} rx="5" ry={tr} fill="#c9cfd5" />
      <ellipse cx="902" cy={cy} rx="3.2" ry={tr - 3} fill="url(#fv-pit-metal)" />
      <Shine x0={310} x1={896} y={cy - tr * 0.4} opacity={0.6} />
      {/* Plastic head: beak at the left, window and blade on top. */}
      <path d={`M302 ${cy - hr} L76 ${cy - hr} Q50 ${cy - hr} 44 ${cy - 11} L40 ${cy + 6} Q40 ${cy + hr} 62 ${cy + hr} L302 ${cy + hr} Z`} fill="url(#fv-plastic)" />
      <rect x="46" y={cy - 15} width="34" height="4" rx="2" fill="#030805" opacity="0.85" />
      <rect x="212" y={cy - 13} width="42" height="15" rx="2" fill="#040a06" />
      <rect x="234" y={cy - 13} width="20" height="15" fill="url(#fv-ramp)" />
      <path d={`M254 ${cy - 13} L254 ${cy + 2}`} stroke="#9fd4b2" stroke-opacity="0.6" stroke-width="1.2" />
      <Shine x0={60} x1={296} y={cy - hr * 0.42} opacity={0.35} />
      {/* Ferrule where the tube enters the head. */}
      <rect x="296" y={cy - hr - 1} width="9" height={2 * hr + 2} rx="2" fill="url(#fv-plastic)" />
      <rect x="296" y={cy - hr - 1} width="9" height={2 * hr + 2} rx="2" fill="url(#fv-shade)" />
      {g.extra.map((l) => <Text l={l} />)}
      <HoleSet p={p} spots={g.spots} metal />
    </Frame>
  );
}

/* ───────────────────────── Recorder ───────────────────────── */

function Recorder(p: Props) {
  const g = RECORDER;
  const { cy } = g;
  const thumb = g.spots[0];
  const head = `M300 ${cy - 25} L112 ${cy - 25} Q64 ${cy - 25} 42 ${cy - 12} Q32 ${cy - 7} 34 ${cy - 2} L36 ${cy + 4} Q60 ${cy + 8} 90 ${cy + 18} Q112 ${cy + 25} 140 ${cy + 25} L300 ${cy + 25} Z`;
  const body = `M300 ${cy - 21} L738 ${cy - 19} L738 ${cy + 19} L300 ${cy + 21} Z`;
  const foot = `M744 ${cy - 20} L816 ${cy - 20} Q858 ${cy - 22} 888 ${cy - 30} L888 ${cy + 30} Q858 ${cy + 22} 816 ${cy + 20} L744 ${cy + 20} Z`;
  return (
    <Frame p={p} kind="recorder" height={g.height}>
      <Defs>
        <clipPath id="fv-recorder-clip"><path d={head} /><path d={body} /><path d={foot} /></clipPath>
      </Defs>
      <Shadow x0={50} x1={890} y={cy + 32} />
      <path d={head} fill="url(#fv-wood)" />
      <path d={body} fill="url(#fv-wood)" />
      <path d={foot} fill="url(#fv-wood)" />
      <g clip-path="url(#fv-recorder-clip)"><Grain x0={30} x1={890} cy={cy} r={24} wavy color="#3b1d0b" /></g>
      {/* Bell end with the bore. */}
      <ellipse cx="888" cy={cy} rx="6" ry="30" fill="#c4865a" />
      <ellipse cx="888" cy={cy} rx="4" ry="21" fill="url(#fv-pit)" />
      {/* Turned beads at the joints. */}
      {[[276, 27], [302, 24], [738, 24]].map(([x, rr]) => (
        <g>
          <rect x={x - 6} y={cy - rr} width="12" height={2 * rr} rx="4" fill="url(#fv-wood)" />
          <rect x={x - 6} y={cy - rr} width="12" height={2 * rr} rx="4" fill="url(#fv-shade)" opacity="0.6" />
          <path d={`M${x} ${cy - rr + 2} L${x} ${cy + rr - 2}`} stroke="#3b1d0b" stroke-opacity="0.5" stroke-width="1" />
        </g>
      ))}
      {/* Windway at the beak, window and blade on the head. */}
      <rect x="38" y={cy - 10} width="34" height="4" rx="2" fill="#160a03" opacity="0.85" />
      <rect x="160" y={cy - 13} width="40" height="15" rx="2" fill="#140902" />
      <rect x="180" y={cy - 13} width="20" height="15" fill="url(#fv-ramp)" />
      <path d={`M200 ${cy - 13} L200 ${cy + 2}`} stroke="#ffd9b0" stroke-opacity="0.5" stroke-width="1.2" />
      <Shine x0={50} x1={880} y={cy - 11} opacity={0.32} />
      {/* The thumb hole is on the back: shown above the tube where the thumb sits. */}
      <path d={`M${thumb.x} ${thumb.y + thumb.r + 6} L${thumb.x} ${cy - 23}`} stroke="var(--muted)" stroke-opacity="0.6" stroke-width="1.2" stroke-dasharray="3 3" />
      <rect x={thumb.x - 17} y={thumb.y - 15} width="34" height="30" rx="9" fill="#2a1a10" stroke="#8a6448" stroke-opacity="0.7" stroke-width="1" />
      {g.extra.map((l) => <Text l={l} />)}
      <HoleSet p={p} spots={g.spots} />
    </Frame>
  );
}

/* ───────────────────────── Concert flute ───────────────────────── */

function ConcertFlute(p: Props) {
  const g = CONCERT;
  const { cy } = g;
  const pressed = new Set<string>(p.held?.keys ?? (p.fingering?.kind === 'keys' ? p.fingering.f.keys : []));
  const known = !!p.held?.keys || p.fingering?.kind === 'keys';
  const keys = Object.entries(CONCERT_KEYS_AT) as [ConcertKey, Spot][];
  return (
    <Frame p={p} kind="concert" height={g.height}>
      <Defs />
      <Shadow x0={40} x1={966} y={cy + 30} />
      {/* Key arms: levers below reach up to the tube, trill keys reach down to the rod. */}
      {keys.map(([, s]) =>
        s.shape === 'trill' ? <path d={`M${s.x} ${s.y + s.r} L${s.x} ${cy - 15}`} stroke="#a7afb8" stroke-width="3" stroke-linecap="round" />
          : s.shape !== 'cup' ? <path d={`M${s.x} ${s.y - (s.h ?? 0) / 2} L${s.x} ${cy + 10}`} stroke="#a7afb8" stroke-width="3" stroke-linecap="round" />
            : null,
      )}
      {/* Head joint with crown, body, foot joint. */}
      <rect x="40" y={cy - 12} width="264" height="24" fill="url(#fv-silver)" />
      <rect x="302" y={cy - 13} width="508" height="26" fill="url(#fv-silver)" />
      <rect x="808" y={cy - 12.5} width="158" height="25" fill="url(#fv-silver)" />
      <ellipse cx="966" cy={cy} rx="3.5" ry="12.5" fill="url(#fv-pit-metal)" />
      <rect x="28" y={cy - 14} width="16" height="28" rx="4" fill="url(#fv-silver)" />
      <path d={`M28 ${cy - 8} Q18 ${cy} 28 ${cy + 8} Z`} fill="url(#fv-silver)" />
      {[302, 808].map((x) => (
        <g>
          <rect x={x - 4} y={cy - 15.5} width="8" height="31" rx="2" fill="url(#fv-silver)" />
          <rect x={x - 4} y={cy - 15.5} width="8" height="31" rx="2" fill="url(#fv-shade)" opacity="0.5" />
        </g>
      ))}
      <Shine x0={44} x1={962} y={cy - 5} opacity={0.7} />
      {/* Lip plate with the embouchure hole. */}
      <path d={`M110 ${cy - 13} Q150 ${cy - 23} 190 ${cy - 13} L192 ${cy + 7} Q150 ${cy + 16} 108 ${cy + 7} Z`} fill="url(#fv-cup)" stroke="#7d868f" stroke-width="0.8" />
      <ellipse cx="150" cy={cy - 3} rx="13" ry="8" fill="#9aa2ab" />
      <ellipse cx="150" cy={cy - 3} rx="11" ry="6.4" fill="url(#fv-pit-metal)" />
      {/* Rod with posts that the keys hinge on. */}
      <rect x="352" y={cy - 17} width="436" height="3" rx="1.5" fill="url(#fv-silver)" />
      <rect x="822" y={cy - 16.5} width="126" height="3" rx="1.5" fill="url(#fv-silver)" />
      {[356, 536, 616, 786, 826, 944].map((x) => <rect x={x - 2.5} y={cy - 20} width="5" height="8" rx="1.5" fill="#8d959e" />)}
      {g.extra.map((l) => <Text l={l} />)}
      {keys.map(([k, s]) => (
        <ConcertKeyShape
          s={s}
          on={pressed.has(k)}
          known={known}
          openHole={s.shape === 'cup'}
          onDown={p.interactive && p.onKey ? (e) => { e.preventDefault(); p.onKey!(k, !pressed.has(k)); } : undefined}
        />
      ))}
    </Frame>
  );
}

function ConcertKeyShape({ s, on, known, openHole, onDown }: { s: Spot; on: boolean; known: boolean; openHole: boolean; onDown?: (e: PointerEvent) => void }) {
  const round = s.shape === 'cup' || s.shape === 'trill';
  const w = s.w ?? 0, h = s.h ?? 0;
  const shape = (extra: number, props: Record<string, unknown>) =>
    round
      ? <circle cx={s.x} cy={s.y} r={s.r + extra} {...props} />
      : <rect x={s.x - w / 2 - extra} y={s.y - h / 2 - extra} width={w + 2 * extra} height={h + 2 * extra} rx={h / 2 + extra} {...props} />;
  return (
    <g class={'hole' + (onDown ? ' touch' : '')} onPointerDown={onDown ? (e) => onDown(e as unknown as PointerEvent) : undefined}>
      <circle cx={s.x} cy={s.y} r={s.hit} fill="transparent" />
      {shape(2, { fill: '#7b848d' })}
      {shape(0, { fill: round ? 'url(#fv-cup)' : 'url(#fv-silver)' })}
      {s.shape === 'roller' && (
        <>
          <path d={`M${s.x - w / 2 + 3} ${s.y - h / 2 + 1} L${s.x - w / 2 + 3} ${s.y + h / 2 - 1}`} stroke="#6f7881" stroke-width="1" />
          <path d={`M${s.x + w / 2 - 3} ${s.y - h / 2 + 1} L${s.x + w / 2 - 3} ${s.y + h / 2 - 1}`} stroke="#6f7881" stroke-width="1" />
        </>
      )}
      {openHole && (
        <>
          <circle cx={s.x} cy={s.y} r={s.r * 0.5} fill="none" stroke="#c4cbd2" stroke-width="2.2" />
          <circle cx={s.x} cy={s.y} r={s.r * 0.36} fill="url(#fv-pit-metal)" />
        </>
      )}
      {on && <g filter="url(#fv-glow)">{shape(3, { class: 'finger' })}</g>}
      {!on && known && shape(3.5, { class: 'open-ring' })}
      {s.label && <Text l={s.label} />}
    </g>
  );
}
