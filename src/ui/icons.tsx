import type { JSX, SVGAttributes } from 'preact';

type P = SVGAttributes<SVGSVGElement> & { size?: number };

const I = (path: JSX.Element | JSX.Element[]) => ({ size = 20, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...rest}>
    {path}
  </svg>
);

export const IconPlay = I(<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />);
export const IconPause = I([<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />, <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />]);
export const IconStop = I(<rect x="6" y="6" width="12" height="12" rx="1.5" />);
export const IconHeadphones = I([<path d="M4 15v-3a8 8 0 0 1 16 0v3" />, <rect x="3" y="14" width="4" height="6" rx="1.5" />, <rect x="17" y="14" width="4" height="6" rx="1.5" />]);
export const IconMenu = I([<path d="M4 7h16" />, <path d="M4 12h16" />, <path d="M4 17h16" />]);
export const IconClose = I([<path d="M6 6l12 12" />, <path d="M18 6L6 18" />]);
export const IconMusic = I([<path d="M9 18V5l11-2v13" />, <circle cx="6.5" cy="18" r="2.5" />, <circle cx="17.5" cy="16" r="2.5" />]);
export const IconVolume = I([<path d="M4 9h4l5-4v14l-5-4H4z" />, <path d="M16.5 8.5a5 5 0 0 1 0 7" />, <path d="M19 6a8.5 8.5 0 0 1 0 12" />]);
export const IconSliders = I([<path d="M4 6h10" />, <path d="M18 6h2" />, <circle cx="16" cy="6" r="2" />, <path d="M4 12h4" />, <path d="M12 12h8" />, <circle cx="10" cy="12" r="2" />, <path d="M4 18h12" />, <circle cx="18" cy="18" r="2" />]);
export const IconMetronome = I([<path d="M8 21h8l-2.5-17h-3z" />, <path d="M12 15l5-8" />, <path d="M6.5 21h11" />]);
export const IconMic = I([<rect x="9" y="3" width="6" height="11" rx="3" />, <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />, <path d="M12 17.5V21" />]);
export const IconRecord = I(<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />);
export const IconKeyboard = I([<rect x="2.5" y="6" width="19" height="12" rx="2" />, <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" />]);
export const IconHand = I([<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />, <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V12" />, <path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5" />]);
export const IconEdit = I([<path d="M4 20h4L19 9l-4-4L4 16z" />, <path d="M13.5 6.5l4 4" />]);
export const IconDrum = I([<ellipse cx="12" cy="8" rx="8" ry="3" />, <path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" />, <path d="M8 3l3 5M16 3l-3 5" />]);
export const IconTuner = I([<path d="M4 17a8 8 0 1 1 16 0" />, <path d="M12 17l4-6" />, <circle cx="12" cy="17" r="1.2" fill="currentColor" />]);
export const IconChart = I([<rect x="4" y="3" width="16" height="18" rx="2" />, <circle cx="12" cy="8" r="1.6" />, <circle cx="12" cy="12.5" r="1.6" />, <circle cx="12" cy="17" r="1.6" fill="currentColor" />]);
export const IconHelp = I([<circle cx="12" cy="12" r="9" />, <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" />, <path d="M12 17h.01" />]);
export const IconTrash = I([<path d="M4 7h16" />, <path d="M10 11v6M14 11v6" />, <path d="M6 7l1 13h10l1-13" />, <path d="M9 7V4h6v3" />]);
export const IconDownload = I([<path d="M12 4v11" />, <path d="M7 10l5 5 5-5" />, <path d="M5 20h14" />]);
export const IconUpload = I([<path d="M12 20V9" />, <path d="M7 14l5-5 5 5" />, <path d="M5 4h14" />]);
export const IconLoop = I([<path d="M17 2l3 3-3 3" />, <path d="M4 11V9a4 4 0 0 1 4-4h12" />, <path d="M7 22l-3-3 3-3" />, <path d="M20 13v2a4 4 0 0 1-4 4H4" />]);
export const IconPlus = I([<path d="M12 5v14" />, <path d="M5 12h14" />]);
export const IconChevron = I(<path d="M6 9l6 6 6-6" />);
export const IconWave = I(<path d="M2 12h3l2-6 4 12 3-9 2 5h6" />);
export const IconBack = I([<path d="M19 12H5" />, <path d="M11 6l-6 6 6 6" />]);

/** Little instrument pictures for the picker. */
export function InstrumentIcon({ id, size = 64 }: { id: string; size?: number }) {
  const w = size, h = size * 0.34;
  switch (id) {
    case 'concert':
      return (
        <svg width={w} height={h} viewBox="0 0 100 34">
          <rect x="2" y="14" width="96" height="7" rx="3" fill="#cfd6dd" />
          <rect x="12" y="10" width="10" height="5" rx="2" fill="#e8edf1" />
          {[42, 50, 58, 70, 78, 86].map((x) => <circle cx={x} cy="17.5" r="2.8" fill="#9aa4ae" stroke="#e8edf1" stroke-width="0.8" />)}
        </svg>
      );
    case 'bansuri':
      return (
        <svg width={w} height={h} viewBox="0 0 100 34">
          <rect x="2" y="12" width="96" height="10" rx="5" fill="#d6ab62" />
          {[9, 30, 90].map((x) => <rect x={x} y="11.5" width="2.5" height="11" fill="#6b2f1d" />)}
          <ellipse cx="18" cy="17" rx="2" ry="1.6" fill="#3a2410" />
          {[50, 57, 64, 74, 81, 88].map((x) => <circle cx={x - 6} cy="17" r="1.8" fill="#3a2410" />)}
        </svg>
      );
    case 'recorder':
      return (
        <svg width={w} height={h} viewBox="0 0 100 34">
          <path d="M2 15 Q6 11 16 11 L86 12 Q94 10 98 8 L98 26 Q94 24 86 22 L16 23 Q6 23 2 19 Z" fill="#b57c4e" />
          <rect x="16" y="14" width="5" height="3" fill="#3a2010" />
          {[34, 42, 50, 60, 68, 76, 84].map((x) => <circle cx={x} cy="17" r="1.8" fill="#3a2010" />)}
        </svg>
      );
    default:
      return (
        <svg width={w} height={h} viewBox="0 0 100 34">
          <path d="M2 13 L26 12 L26 22 L2 21 Z" fill="#2f5d43" />
          <rect x="25" y="12.5" width="73" height="9" rx="1.5" fill="#c3cad1" />
          <rect x="16" y="15" width="5" height="4" fill="#0d1a12" />
          {[46, 54, 62, 74, 82, 90].map((x) => <circle cx={x} cy="17" r="2" fill="#4b525a" />)}
        </svg>
      );
  }
}
