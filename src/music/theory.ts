export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Sargam syllables for the 12 semitones above Sa. Lowercase 'komal'/'tivra' marked in the long names. */
export const SARGAM_SHORT = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
export const SARGAM_LONG = [
  'Sa', 'Komal Re', 'Re', 'Komal Ga', 'Ga', 'Ma', 'Tivra Ma', 'Pa', 'Komal Dha', 'Dha', 'Komal Ni', 'Ni',
];
export const SARGAM_SYLLABLE = ['Sa', 're', 'Re', 'ga', 'Ga', 'Ma', 'Ma#', 'Pa', 'dha', 'Dha', 'ni', 'Ni'];

export const LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export const pc = (midi: number) => ((Math.round(midi) % 12) + 12) % 12;

/** Keys whose signatures use flats (by tonic pitch class). */
const FLAT_TONICS = new Set([5, 10, 3, 8, 1]);

export function noteName(midi: number, opts: { flats?: boolean; octave?: boolean } = {}): string {
  const names = opts.flats ? FLAT_NAMES : SHARP_NAMES;
  const n = names[pc(midi)];
  if (opts.octave === false) return n;
  return n + (Math.floor(Math.round(midi) / 12) - 1);
}

export function useFlatsForKey(tonicPc: number): boolean {
  return FLAT_TONICS.has(((tonicPc % 12) + 12) % 12);
}

/**
 * Sargam name for a note relative to Sa. Octave shown with dots in Hindustani style:
 * mandra (lower) gets a dot below (rendered as a trailing "̣"), taar (upper) a dot above ("̇").
 */
export function sargamName(midi: number, saMidi: number, long = false): string {
  const rel = Math.round(midi) - saMidi;
  const idx = ((rel % 12) + 12) % 12;
  const oct = Math.floor(rel / 12);
  const base = long ? SARGAM_LONG[idx] : SARGAM_SYLLABLE[idx];
  if (oct < 0) return base + '̣'.repeat(-oct);
  if (oct > 0) return base + '̇'.repeat(oct);
  return base;
}

export function sargamOctaveLabel(midi: number, saMidi: number): string {
  const oct = Math.floor((Math.round(midi) - saMidi) / 12);
  return oct < 0 ? 'Mandra' : oct > 0 ? 'Taar' : 'Madhya';
}

/** Parse "C#4", "Bb", "eb5" into a MIDI number. Without octave, uses defaultOctave. */
export function parseNoteName(s: string, defaultOctave = 4): number | null {
  const m = /^([A-Ga-g])([#b♯♭]{0,2})(-?\d)?$/.exec(s.trim());
  if (!m) return null;
  let p = LETTER_TO_PC[m[1].toUpperCase()];
  for (const ch of m[2]) p += ch === '#' || ch === '♯' ? 1 : -1;
  const oct = m[3] !== undefined ? parseInt(m[3], 10) : defaultOctave;
  return (oct + 1) * 12 + p;
}

export interface Detune {
  midi: number; // nearest note
  cents: number; // -50..50
}

export function nearestNote(freq: number, a4 = 440): Detune {
  const m = freqToMidi(freq, a4);
  const midi = Math.round(m);
  return { midi, cents: (m - midi) * 100 };
}

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Krumhansl–Schmuckler key estimate from note pitches weighted by duration. */
export function estimateKey(notes: { midi: number; dur: number }[]): { tonic: number; mode: 'major' | 'minor' } {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[pc(n.midi)] += n.dur;
  let best = { tonic: 0, mode: 'major' as 'major' | 'minor', score: -Infinity };
  for (let t = 0; t < 12; t++) {
    for (const [mode, prof] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]] as const) {
      const score = correlate(hist, prof, t);
      if (score > best.score) best = { tonic: t, mode, score };
    }
  }
  return { tonic: best.tonic, mode: best.mode };
}

function correlate(hist: number[], prof: number[], shift: number): number {
  const mh = hist.reduce((a, b) => a + b, 0) / 12;
  const mp = prof.reduce((a, b) => a + b, 0) / 12;
  let num = 0, dh = 0, dp = 0;
  for (let i = 0; i < 12; i++) {
    const h = hist[(i + shift) % 12] - mh;
    const p = prof[i] - mp;
    num += h * p;
    dh += h * h;
    dp += p * p;
  }
  return dh && dp ? num / Math.sqrt(dh * dp) : 0;
}

export function keyLabel(tonic: number, mode: 'major' | 'minor'): string {
  const flats = useFlatsForKey(mode === 'minor' ? tonic + 3 : tonic);
  return noteName(tonic, { flats, octave: false }) + (mode === 'minor' ? 'm' : '');
}
