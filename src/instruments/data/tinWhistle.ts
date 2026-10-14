import type { FingeringTable, HoleFingering } from '../types';

// Sources:
//   https://greylarsen.com/FreeDownloads/Fingering_Chart_with_Half-Hole_Fingerings.pdf
//   https://www.wfg.woodwind.org/tinwhistle/tw_bas_1.html
//   https://www.wfg.woodwind.org/tinwhistle/tw_bas_2.html
// D whistle, keyed by semitone offset from the lowest note (D = 0). Holes 1-6 from the mouthpiece down.
export const tinWhistleFingerings: FingeringTable<HoleFingering> = {
  0: { primary: { holes: [1, 1, 1, 1, 1, 1], register: 1, hint: 'D' } },
  1: { primary: { holes: [1, 1, 1, 1, 1, 0.5], register: 1, hint: 'D#/Eb (half-hole)' } },
  2: { primary: { holes: [1, 1, 1, 1, 1, 0], register: 1, hint: 'E' } },
  3: { primary: { holes: [1, 1, 1, 1, 0.5, 0], register: 1, hint: 'F natural (half-hole)' } },
  4: { primary: { holes: [1, 1, 1, 1, 0, 0], register: 1, hint: 'F#' } },
  5: { primary: { holes: [1, 1, 1, 0, 0, 0], register: 1, hint: 'G' } },
  6: { primary: { holes: [1, 1, 0.5, 0, 0, 0], register: 1, hint: 'G#/Ab (half-hole)' } },
  7: { primary: { holes: [1, 1, 0, 0, 0, 0], register: 1, hint: 'A' } },
  8: { primary: { holes: [1, 0.5, 0, 0, 0, 0], register: 1, hint: 'A#/Bb (half-hole)' } },
  9: { primary: { holes: [1, 0, 0, 0, 0, 0], register: 1, hint: 'B' } },
  10: {
    primary: { holes: [0, 1, 1, 0, 0, 0], register: 1, hint: 'C natural (cross-fingering)' },
    alternates: [
      { holes: [0.5, 0, 0, 0, 0, 0], register: 1, hint: 'C natural (half-hole)' },
      { holes: [0, 1, 0, 1, 1, 1], register: 1, hint: 'C natural (alternate cross-fingering)' },
      { holes: [0, 1, 0, 0, 1, 1], register: 1, hint: 'C natural (alternate cross-fingering)' },
    ],
  },
  11: {
    primary: { holes: [0, 0, 0, 0, 0, 0], register: 1, hint: 'C#' },
    alternates: [{ holes: [0, 0, 0, 0, 0, 1], register: 1, hint: 'C# (bottom finger down for balance)' }],
  },
  12: {
    primary: { holes: [0, 1, 1, 1, 1, 1], register: 2, hint: 'High D (top hole open)' },
    alternates: [{ holes: [1, 1, 1, 1, 1, 1], register: 2, hint: 'High D (all holes closed)' }],
  },
  13: { primary: { holes: [1, 1, 1, 1, 1, 0.5], register: 2, hint: 'High D#/Eb (half-hole)' } },
  14: { primary: { holes: [1, 1, 1, 1, 1, 0], register: 2, hint: 'High E' } },
  15: { primary: { holes: [1, 1, 1, 1, 0.5, 0], register: 2, hint: 'High F natural (half-hole)' } },
  16: { primary: { holes: [1, 1, 1, 1, 0, 0], register: 2, hint: 'High F#' } },
  17: { primary: { holes: [1, 1, 1, 0, 0, 0], register: 2, hint: 'High G' } },
  18: { primary: { holes: [1, 1, 0.5, 0, 0, 0], register: 2, hint: 'High G#/Ab (half-hole)' } },
  19: { primary: { holes: [1, 1, 0, 0, 0, 0], register: 2, hint: 'High A' } },
  20: { primary: { holes: [1, 0.5, 0, 0, 0, 0], register: 2, hint: 'High A#/Bb (half-hole)' } },
  21: { primary: { holes: [1, 0, 0, 0, 0, 0], register: 2, hint: 'High B' } },
  22: { primary: { holes: [0.5, 0, 0, 0, 0, 0], register: 2, hint: 'High C natural (half-hole)' } },
  23: {
    primary: { holes: [0, 0, 0, 0, 0, 0], register: 2, hint: 'High C#' },
    alternates: [{ holes: [0, 0, 0, 0, 0, 1], register: 2, hint: 'High C# (bottom finger down for balance)' }],
  },
};
