import type { FingeringTable, KeyFingering } from '../types';

// Sources:
//   https://www.wfg.woodwind.org/flute/fl_bas_1.html
//   https://www.wfg.woodwind.org/flute/fl_bas_2.html
//   https://www.wfg.woodwind.org/flute/fl_bas_3.html
//   https://www.fingercharts.com/flute/ (fingering data marked "basic")
// Keyed by absolute MIDI note. Boehm C flute, C foot. Tr1 = D trill key, Tr2 = D# trill key.
export const concertFluteFingerings: FingeringTable<KeyFingering> = {
  60: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'C'], hint: 'Low C' } },
  61: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'Cs'], hint: 'Low C#' } },
  62: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3'], hint: 'Low D: pinky off' } },
  63: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'Eb'] } },
  64: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'Eb'] } },
  65: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'Eb'] } },
  66: {
    primary: { keys: ['T', 'L1', 'L2', 'L3', 'R3', 'Eb'] },
    alternates: [{ keys: ['T', 'L1', 'L2', 'L3', 'R2', 'Eb'], hint: 'R2 instead of R3, for trills/slurs with E' }],
  },
  67: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'Eb'] } },
  68: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'Gs', 'Eb'] } },
  69: { primary: { keys: ['T', 'L1', 'L2', 'Eb'] } },
  70: {
    primary: { keys: ['T', 'L1', 'R1', 'Eb'], hint: '1-and-1 B-flat' },
    alternates: [{ keys: ['Tb', 'L1', 'Eb'], hint: 'thumb B-flat; avoid in passages with B natural' }],
  },
  71: { primary: { keys: ['T', 'L1', 'Eb'] } },
  72: { primary: { keys: ['L1', 'Eb'] } },
  73: { primary: { keys: ['Eb'] } },
  74: { primary: { keys: ['T', 'L2', 'L3', 'R1', 'R2', 'R3'], hint: 'Middle D: L1 up, pinky off' } },
  75: { primary: { keys: ['T', 'L2', 'L3', 'R1', 'R2', 'R3', 'Eb'], hint: 'L1 up' } },
  76: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'Eb'] } },
  77: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'R1', 'Eb'] } },
  78: {
    primary: { keys: ['T', 'L1', 'L2', 'L3', 'R3', 'Eb'] },
    alternates: [{ keys: ['T', 'L1', 'L2', 'L3', 'R2', 'Eb'], hint: 'R2 instead of R3, for trills/slurs with E' }],
  },
  79: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'Eb'] } },
  80: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'Gs', 'Eb'] } },
  81: { primary: { keys: ['T', 'L1', 'L2', 'Eb'] } },
  82: {
    primary: { keys: ['T', 'L1', 'R1', 'Eb'], hint: '1-and-1 B-flat' },
    alternates: [{ keys: ['Tb', 'L1', 'Eb'], hint: 'thumb B-flat; avoid in passages with B natural' }],
  },
  83: { primary: { keys: ['T', 'L1', 'Eb'] } },
  84: { primary: { keys: ['L1', 'Eb'] } },
  85: { primary: { keys: ['Eb'] } },
  86: { primary: { keys: ['T', 'L2', 'L3', 'Eb'], hint: 'High D' } },
  87: { primary: { keys: ['T', 'L1', 'L2', 'L3', 'Gs', 'R1', 'R2', 'R3', 'Eb'] } },
  88: { primary: { keys: ['T', 'L1', 'L2', 'R1', 'R2', 'Eb'] } },
  89: { primary: { keys: ['T', 'L1', 'L3', 'R1', 'Eb'] } },
  90: { primary: { keys: ['T', 'L1', 'L3', 'R3', 'Eb'] } },
  91: { primary: { keys: ['L1', 'L2', 'L3', 'Eb'], hint: 'thumb off' } },
  92: { primary: { keys: ['L2', 'L3', 'Gs', 'Eb'], hint: 'thumb off' } },
  93: { primary: { keys: ['T', 'L2', 'R1', 'Eb'] } },
  94: {
    primary: { keys: ['T', 'R1', 'Tr1'], hint: 'first (D) trill key' },
    alternates: [{ keys: ['T', 'R1', 'Tr1', 'Eb'], hint: 'with E-flat key' }],
  },
  95: {
    primary: { keys: ['T', 'L1', 'L3', 'Tr2'], hint: 'second (D#) trill key' },
    alternates: [{ keys: ['T', 'L1', 'L3', 'Tr2', 'Eb'], hint: 'with E-flat key' }],
  },
  96: { primary: { keys: ['L1', 'L2', 'L3', 'Gs', 'R1'], hint: 'High C (C foot): thumb off, pinky off' } },
};
