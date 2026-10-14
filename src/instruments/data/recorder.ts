import type { FingeringTable, HoleFingering } from '../types';

// Sources:
//   https://dolmetsch.com/textfingeringchart.htm
//   https://www.yamaha.com/en/musical_instrument_guide/common/images/recorder/fingering_baroque.pdf
//   https://www.wfg.woodwind.org/recorder/rec_bas_1.html
//   https://www.wfg.woodwind.org/recorder/rec_bas_2.html
//   https://www.wfg.woodwind.org/recorder/rec_bas_3.html
// Soprano, Baroque (English) fingering, keyed by sounding MIDI note.
// holes[0] = thumb (0.5 = pinched), holes[1..7] = front holes top to bottom; 0.5 on 6/7 = one of the double holes.
export const recorderFingerings: FingeringTable<HoleFingering> = {
  72: { primary: { holes: [1, 1, 1, 1, 1, 1, 1, 1], register: 1, hint: 'C' } },
  73: { primary: { holes: [1, 1, 1, 1, 1, 1, 1, 0.5], register: 1, hint: 'C#: one small hole of 7' } },
  74: { primary: { holes: [1, 1, 1, 1, 1, 1, 1, 0], register: 1, hint: 'D' } },
  75: { primary: { holes: [1, 1, 1, 1, 1, 1, 0.5, 0], register: 1, hint: 'Eb: one small hole of 6' } },
  76: { primary: { holes: [1, 1, 1, 1, 1, 1, 0, 0], register: 1, hint: 'E' } },
  77: { primary: { holes: [1, 1, 1, 1, 1, 0, 1, 1], register: 1, hint: 'F (fork)' } },
  78: { primary: { holes: [1, 1, 1, 1, 0, 1, 1, 0], register: 1, hint: 'F#' } },
  79: { primary: { holes: [1, 1, 1, 1, 0, 0, 0, 0], register: 1, hint: 'G' } },
  80: { primary: { holes: [1, 1, 1, 0, 1, 1, 0.5, 0], register: 1, hint: 'G#: one small hole of 6' } },
  81: { primary: { holes: [1, 1, 1, 0, 0, 0, 0, 0], register: 1, hint: 'A' } },
  82: { primary: { holes: [1, 1, 0, 1, 1, 0, 0, 0], register: 1, hint: 'Bb' } },
  83: {
    primary: { holes: [1, 1, 0, 0, 0, 0, 0, 0], register: 1, hint: 'B' },
    alternates: [{ holes: [1, 0, 1, 1, 0, 0, 0, 0], register: 1, hint: 'B (alternate, use with C)' }],
  },
  84: { primary: { holes: [1, 0, 1, 0, 0, 0, 0, 0], register: 1, hint: 'C' } },
  85: {
    primary: { holes: [0, 1, 1, 0, 0, 0, 0, 0], register: 1, hint: 'C#: thumb off' },
    alternates: [{ holes: [1, 0, 0, 0, 0, 0, 0, 0], register: 1, hint: 'C# (alternate): thumb only' }],
  },
  86: { primary: { holes: [0, 0, 1, 0, 0, 0, 0, 0], register: 1, hint: 'D: thumb off' } },
  87: { primary: { holes: [0, 0, 1, 1, 1, 1, 1, 0], register: 2, hint: 'Eb: thumb off' } },
  88: { primary: { holes: [0.5, 1, 1, 1, 1, 1, 0, 0], register: 2, hint: 'E: pinched thumb' } },
  89: { primary: { holes: [0.5, 1, 1, 1, 1, 0, 1, 0], register: 2, hint: 'F: pinched thumb' } },
  90: { primary: { holes: [0.5, 1, 1, 1, 0, 1, 0, 0], register: 2, hint: 'F#: pinched thumb' } },
  91: { primary: { holes: [0.5, 1, 1, 1, 0, 0, 0, 0], register: 2, hint: 'G: pinched thumb' } },
  92: { primary: { holes: [0.5, 1, 1, 0, 1, 0, 0, 0], register: 2, hint: 'G#: pinched thumb' } },
  93: { primary: { holes: [0.5, 1, 1, 0, 0, 0, 0, 0], register: 2, hint: 'A: pinched thumb' } },
  94: {
    primary: { holes: [0.5, 1, 1, 0, 1, 1, 1, 0], register: 2, hint: 'Bb: pinched thumb' },
    alternates: [{ holes: [0.5, 1, 1, 0, 0, 1, 1, 0], register: 2, hint: 'Bb (alternate): pinched thumb' }],
  },
  95: {
    primary: { holes: [0.5, 1, 1, 0, 1, 1, 0, 0], register: 2, hint: 'B: pinched thumb' },
    alternates: [{ holes: [0.5, 1, 0, 0, 0, 1, 1, 1], register: 2, hint: 'B (alternate): pinched thumb' }],
  },
  96: { primary: { holes: [0.5, 1, 0, 0, 1, 1, 0, 0], register: 3, hint: 'C: pinched thumb' } },
  97: {
    primary: { holes: [0.5, 1, 0, 1, 1, 0, 1, 0], register: 3, hint: 'C#: pinched thumb, close the bell end (e.g. against your knee)' },
    alternates: [{ holes: [0.5, 1, 0, 1, 1, 1, 0, 1], register: 3, hint: 'C# (alternate, no bell closing): pinched thumb' }],
  },
  98: { primary: { holes: [0.5, 1, 0, 1, 1, 0, 1, 0], register: 3, hint: 'D: pinched thumb' } },
};
