import type { FingeringTable, HoleFingering } from '../types';

// Sources:
//   https://oneworldflutes.com/PDF/FlutesFingeringChart.pdf (David Philipson chart, https://davidphilipson.com/music/bansuri/)
//   https://www.sound-of-bansuri.com/finger-chart-for-bansuri/
//   https://flutesangam.com/learn/fingering-chart
// Keyed by semitone offset from Sa (Sa = top three holes closed). Holes 1-6 from the mouth hole down.
export const bansuriFingerings: FingeringTable<HoleFingering> = {
  [-5]: { primary: { holes: [1, 1, 1, 1, 1, 1], register: 1, hint: 'Mandra Pa' } },
  [-4]: { primary: { holes: [1, 1, 1, 1, 1, 0.5], register: 1, hint: 'Mandra Komal Dha' } },
  [-3]: { primary: { holes: [1, 1, 1, 1, 1, 0], register: 1, hint: 'Mandra Dha' } },
  [-2]: { primary: { holes: [1, 1, 1, 1, 0.5, 0], register: 1, hint: 'Mandra Komal Ni' } },
  [-1]: { primary: { holes: [1, 1, 1, 1, 0, 0], register: 1, hint: 'Mandra Ni' } },
  0: { primary: { holes: [1, 1, 1, 0, 0, 0], register: 1, hint: 'Sa' } },
  1: { primary: { holes: [1, 1, 0.5, 0, 0, 0], register: 1, hint: 'Komal Re' } },
  2: { primary: { holes: [1, 1, 0, 0, 0, 0], register: 1, hint: 'Re' } },
  3: { primary: { holes: [1, 0.5, 0, 0, 0, 0], register: 1, hint: 'Komal Ga' } },
  4: { primary: { holes: [1, 0, 0, 0, 0, 0], register: 1, hint: 'Ga' } },
  5: {
    primary: { holes: [0.5, 0, 0, 0, 0, 0], register: 1, hint: 'Shuddh Ma' },
    alternates: [{ holes: [0, 1, 1, 0, 0, 0], register: 1, hint: 'Shuddh Ma (cross-fingering; check intonation)' }],
  },
  6: { primary: { holes: [0, 0, 0, 0, 0, 0], register: 1, hint: 'Tivra Ma' } },
  7: {
    primary: { holes: [1, 1, 1, 1, 1, 1], register: 2, hint: 'Pa' },
    alternates: [{ holes: [0, 1, 1, 1, 1, 1], register: 2, hint: 'Pa (top hole open)' }],
  },
  8: { primary: { holes: [1, 1, 1, 1, 1, 0.5], register: 2, hint: 'Komal Dha' } },
  9: { primary: { holes: [1, 1, 1, 1, 1, 0], register: 2, hint: 'Dha' } },
  10: { primary: { holes: [1, 1, 1, 1, 0.5, 0], register: 2, hint: 'Komal Ni' } },
  11: { primary: { holes: [1, 1, 1, 1, 0, 0], register: 2, hint: 'Ni' } },
  12: { primary: { holes: [1, 1, 1, 0, 0, 0], register: 2, hint: 'Taar Sa' } },
  13: { primary: { holes: [1, 1, 0.5, 0, 0, 0], register: 2, hint: 'Taar Komal Re' } },
  14: { primary: { holes: [1, 1, 0, 0, 0, 0], register: 2, hint: 'Taar Re' } },
  15: { primary: { holes: [1, 0.5, 0, 0, 0, 0], register: 2, hint: 'Taar Komal Ga' } },
  16: { primary: { holes: [1, 0, 0, 0, 0, 0], register: 2, hint: 'Taar Ga' } },
  17: { primary: { holes: [0.5, 0, 0, 0, 0, 0], register: 2, hint: 'Taar Shuddh Ma' } },
  18: { primary: { holes: [0, 0, 0, 0, 0, 0], register: 2, hint: 'Taar Tivra Ma' } },
  19: {
    primary: { holes: [0, 1, 1, 1, 1, 1], register: 3, hint: 'Taar Pa' },
    alternates: [{ holes: [0, 1, 1, 0, 0, 0], register: 3, hint: 'Taar Pa (alternate)' }],
  },
};
