export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffd884" />
          <stop offset="1" stop-color="#d98f2b" />
        </linearGradient>
      </defs>
      <rect x="3" y="16" width="34" height="8" rx="4" transform="rotate(-28 20 20)" fill="url(#logoG)" />
      {[0, 1, 2, 3].map((i) => (
        <circle cx={15 + i * 5.2} cy={21.5 - i * 2.75} r="1.5" fill="#1a1c20" />
      ))}
      <path d="M6 31c4-1 6-4 6-4" stroke="#ffd884" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.7" />
      <path d="M3 27c3 0 5-2 5-2" stroke="#ffd884" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.5" />
    </svg>
  );
}
