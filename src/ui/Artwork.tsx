import type { Song } from '../music/song';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Generated cover art: colour from the title, a motif from the tags. */
export function Artwork({ song, size = 92 }: { song: Song; size?: number }) {
  const h = hash(song.title);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h >> 8) % 60) % 360;
  const tags = song.tags ?? [];
  const motif = tags.includes('Raga') ? 'lotus' : tags.includes('Irish') || tags.includes('Folk') ? 'hills' : tags.includes('Classical') ? 'staff' : tags.includes('Holiday') ? 'stars' : 'waves';
  const id = 'art' + h;
  return (
    <svg class="art" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={`hsl(${hue} 55% 42%)`} />
          <stop offset="1" stop-color={`hsl(${hue2} 60% 22%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="10" fill={`url(#${id})`} />
      {motif === 'waves' && [0, 1, 2, 3].map((i) => <path d={`M-5 ${58 + i * 11} Q 25 ${46 + i * 11} 50 ${58 + i * 11} T 105 ${58 + i * 11}`} stroke="rgba(255,255,255,0.22)" stroke-width="3" fill="none" />)}
      {motif === 'hills' && <><path d="M0 75 Q 30 45 55 70 T 100 60 V100 H0Z" fill="rgba(0,0,0,0.25)" /><path d="M0 85 Q 40 60 70 82 T 100 78 V100 H0Z" fill="rgba(0,0,0,0.3)" /><circle cx="72" cy="30" r="10" fill="rgba(255,240,200,0.6)" /></>}
      {motif === 'staff' && [0, 1, 2, 3, 4].map((i) => <line x1="8" x2="92" y1={40 + i * 8} y2={40 + i * 8} stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />)}
      {motif === 'staff' && <><circle cx="35" cy="60" r="5" fill="rgba(255,255,255,0.7)" /><line x1="40" x2="40" y1="60" y2="32" stroke="rgba(255,255,255,0.7)" stroke-width="2" /><circle cx="62" cy="48" r="5" fill="rgba(255,255,255,0.7)" /><line x1="67" x2="67" y1="48" y2="22" stroke="rgba(255,255,255,0.7)" stroke-width="2" /></>}
      {motif === 'lotus' && [-50, -25, 0, 25, 50].map((a) => <ellipse cx="50" cy="52" rx="8" ry="22" transform={`rotate(${a} 50 70)`} fill="rgba(255,220,230,0.35)" />)}
      {motif === 'stars' && [[25, 30], [70, 22], [50, 50], [80, 60], [20, 70]].map(([x, y]) => <path d={`M${x} ${y - 6} L${x + 1.8} ${y - 1.8} L${x + 6} ${y} L${x + 1.8} ${y + 1.8} L${x} ${y + 6} L${x - 1.8} ${y + 1.8} L${x - 6} ${y} L${x - 1.8} ${y - 1.8}Z`} fill="rgba(255,250,220,0.75)" />)}
      <text x="10" y="28" font-size="22" font-weight="700" fill="rgba(255,255,255,0.9)" font-family="Inter, sans-serif">{song.title.replace(/^(The|A)\s+/, '')[0]}</text>
    </svg>
  );
}
