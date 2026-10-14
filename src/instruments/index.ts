import type { Timbre } from '../audio/voice';
import type { FingeringTable, HoleFingering, KeyFingering } from './types';
import { concertFluteFingerings } from './data/concertFlute';
import { bansuriFingerings } from './data/bansuri';
import { recorderFingerings } from './data/recorder';
import { tinWhistleFingerings } from './data/tinWhistle';
import { noteName, parseNoteName } from '../music/theory';

export type InstrumentId = 'concert' | 'bansuri' | 'recorder' | 'whistle';

export type Fingering =
  | { kind: 'keys'; f: KeyFingering; alternates: KeyFingering[] }
  | { kind: 'holes'; f: HoleFingering; alternates: HoleFingering[] };

export interface KeyOption {
  /** MIDI note the table offsets are measured from (Sa for bansuri, the bottom note for whistles). */
  root: number;
  label: string;
}

export interface Instrument {
  id: InstrumentId;
  name: string;
  short: string;
  blurb: string;
  naming: 'western' | 'sargam';
  holeCount: number;
  /** Number of holes the top hand covers (drawn closer to the mouthpiece). */
  topHand: number;
  hasThumbHole?: boolean;
  keyOptions: KeyOption[];
  defaultKey: number;
  timbre: Timbre;
  fingering(midi: number, root: number): Fingering | null;
  range(root: number): [number, number];
  /** Notes in the table, ascending. */
  notes(root: number): number[];
  /** Bottom-row note of the on-screen keyboard (rows go up an octave each). */
  layoutBase(root: number): number;
}

function tableNotes<F>(table: FingeringTable<F>, offset: number): number[] {
  return Object.keys(table).map((k) => Number(k) + offset).sort((a, b) => a - b);
}

function holesLookup(table: FingeringTable<HoleFingering>) {
  return (midi: number, root: number): Fingering | null => {
    const e = table[midi - root];
    return e ? { kind: 'holes', f: e.primary, alternates: e.alternates ?? [] } : null;
  };
}

const range = (ns: number[]): [number, number] => [ns[0], ns[ns.length - 1]];

const CONCERT: Instrument = {
  id: 'concert',
  name: 'Concert flute',
  short: 'Concert',
  blurb: 'Boehm-system C flute, three octaves from middle C.',
  naming: 'western',
  holeCount: 0,
  topHand: 0,
  keyOptions: [{ root: 0, label: 'C (concert pitch)' }],
  defaultKey: 0,
  timbre: {
    harmonicsLow: [1, 0.42, 0.16, 0.09, 0.045, 0.025, 0.012],
    harmonicsHigh: [1, 0.2, 0.06, 0.02, 0.01],
    registerBreak: 86,
    breath: 0.075,
    breathQ: 9,
    hiss: 0.012,
    chiff: 0.06,
    attack: 0.07,
    release: 0.12,
    scoop: -18,
    vibratoRate: 5.2,
    vibratoCents: 9,
    vibratoAmp: 0.12,
    vibratoDelay: 0.35,
    brightness: 5,
    glide: 0.03,
    gain: 0.55,
    sampleSet: 'concert',
    sampleVibrato: 0,
    model: {
      noise: 0.09, airMix: 0.45, brightness: 5, vibratoRate: 5.3, vibratoDepth: 0.5, vibratoDelay: 0.32,
      attack: 0.05, release: 0.09, chiff: 0.6, tongue: 0.8, glide: 0.035, gain: 0.9,
      body: [
        { type: 'highpass', freq: 160, q: 0.6 },
        { type: 'peaking', freq: 2600, q: 1, gain: 2.5 },
        { type: 'lowpass', freq: 9000, q: 0.5 },
      ],
    },
  },
  fingering: (midi) => {
    const e = concertFluteFingerings[midi];
    return e ? { kind: 'keys', f: e.primary as KeyFingering, alternates: e.alternates ?? [] } : null;
  },
  notes: () => tableNotes(concertFluteFingerings, 0),
  range: () => range(tableNotes(concertFluteFingerings, 0)),
  layoutBase: () => 60,
};

const BANSURI_KEYS: KeyOption[] = [];
for (let m = parseNoteName('G3')!; m <= parseNoteName('C5')!; m++) {
  BANSURI_KEYS.push({ root: m, label: `${noteName(m, { flats: [1, 3, 8, 10].includes(m % 12) })} bansuri (Sa = ${noteName(m)})` });
}

const BANSURI: Instrument = {
  id: 'bansuri',
  name: 'Bansuri',
  short: 'Bansuri',
  blurb: 'Six-hole bamboo flute of Hindustani music. Notes in Sargam.',
  naming: 'sargam',
  holeCount: 6,
  topHand: 3,
  keyOptions: BANSURI_KEYS,
  defaultKey: parseNoteName('E4')!,
  timbre: {
    harmonicsLow: [1, 0.55, 0.26, 0.16, 0.08, 0.05, 0.03, 0.015],
    harmonicsHigh: [1, 0.3, 0.1, 0.04, 0.02],
    registerBreak: 200, // set per key below
    breath: 0.14,
    breathQ: 6,
    hiss: 0.022,
    chiff: 0.05,
    attack: 0.09,
    release: 0.18,
    scoop: -35,
    vibratoRate: 4.6,
    vibratoCents: 7,
    vibratoAmp: 0.16,
    vibratoDelay: 0.5,
    brightness: 4,
    glide: 0.05,
    gain: 0.6,
    sampleSet: 'bansuri',
    sampleVibrato: 4,
    model: {
      // Bamboo: very breathy, dark and woody, slow wide vibrato, long gliding meend between notes.
      noise: 0.17, airMix: 1.1, brightness: 4, vibratoRate: 4.6, vibratoDepth: 0.45, vibratoDelay: 0.55,
      attack: 0.075, release: 0.16, chiff: 1.2, tongue: 0.5, glide: 0.07, gain: 1,
      body: [
        { type: 'highpass', freq: 120, q: 0.6 },
        { type: 'lowshelf', freq: 300, gain: 2.5 },
        { type: 'peaking', freq: 1150, q: 1.1, gain: 3 },
        { type: 'peaking', freq: 3200, q: 1.5, gain: -2 },
        { type: 'lowpass', freq: 6500, q: 0.5 },
      ],
    },
  },
  fingering: holesLookup(bansuriFingerings),
  notes: (sa) => tableNotes(bansuriFingerings, sa),
  range: (sa) => range(tableNotes(bansuriFingerings, sa)),
  layoutBase: (sa) => sa - 12,
};

const RECORDER: Instrument = {
  id: 'recorder',
  name: 'Recorder',
  short: 'Recorder',
  blurb: 'Soprano recorder with baroque fingering. Sounds an octave above written.',
  naming: 'western',
  holeCount: 8,
  topHand: 4,
  hasThumbHole: true,
  keyOptions: [{ root: 0, label: 'Soprano in C' }],
  defaultKey: 0,
  timbre: {
    harmonicsLow: [1, 0.22, 0.28, 0.06, 0.09, 0.02, 0.03],
    harmonicsHigh: [1, 0.12, 0.12, 0.03],
    registerBreak: 86,
    breath: 0.035,
    breathQ: 14,
    hiss: 0.006,
    chiff: 0.13,
    attack: 0.03,
    release: 0.06,
    scoop: -6,
    vibratoRate: 5,
    vibratoCents: 3,
    vibratoAmp: 0.05,
    vibratoDelay: 0.6,
    brightness: 6,
    glide: 0.015,
    gain: 0.5,
    sampleSet: 'recorder',
    sampleVibrato: 3,
    model: {
      // Wooden fipple flute: clean, focused tone with a crisp chiff and little vibrato.
      noise: 0.04, airMix: 0.22, brightness: 5, vibratoRate: 5, vibratoDepth: 0.12, vibratoDelay: 0.6,
      attack: 0.025, release: 0.05, chiff: 1.6, tongue: 1, glide: 0.015, gain: 0.85,
      body: [
        { type: 'highpass', freq: 220, q: 0.6 },
        { type: 'peaking', freq: 1700, q: 1.2, gain: 2 },
        { type: 'lowpass', freq: 8000, q: 0.5 },
      ],
    },
  },
  fingering: (midi) => {
    const e = recorderFingerings[midi];
    return e ? { kind: 'holes', f: e.primary, alternates: e.alternates ?? [] } : null;
  },
  notes: () => tableNotes(recorderFingerings, 0),
  range: () => range(tableNotes(recorderFingerings, 0)),
  layoutBase: () => 72,
};

const WHISTLE_KEYS: KeyOption[] = [
  ['D5', 'High D whistle'], ['C5', 'C whistle'], ['Bb4', 'B♭ whistle'], ['A4', 'A whistle'],
  ['G4', 'G whistle'], ['F4', 'F whistle'], ['Eb5', 'E♭ whistle'], ['D4', 'Low D whistle'],
].map(([n, label]) => ({ root: parseNoteName(n)!, label }));

const WHISTLE: Instrument = {
  id: 'whistle',
  name: 'Tin whistle',
  short: 'Whistle',
  blurb: 'Six-hole penny whistle of Irish and folk music.',
  naming: 'western',
  holeCount: 6,
  topHand: 3,
  keyOptions: WHISTLE_KEYS,
  defaultKey: parseNoteName('D5')!,
  timbre: {
    harmonicsLow: [1, 0.62, 0.42, 0.22, 0.14, 0.09, 0.05, 0.03],
    harmonicsHigh: [1, 0.35, 0.16, 0.06, 0.03],
    registerBreak: 200,
    breath: 0.06,
    breathQ: 10,
    hiss: 0.014,
    chiff: 0.16,
    attack: 0.025,
    release: 0.07,
    scoop: -10,
    vibratoRate: 5.5,
    vibratoCents: 4,
    vibratoAmp: 0.06,
    vibratoDelay: 0.55,
    brightness: 7,
    glide: 0.012,
    gain: 0.42,
    sampleSet: 'whistle',
    sampleVibrato: 3,
    model: {
      // Metal tube with a plastic fipple: bright, reedy, quick attack for cuts and taps.
      noise: 0.07, airMix: 0.4, brightness: 5, vibratoRate: 5.6, vibratoDepth: 0.16, vibratoDelay: 0.5,
      attack: 0.02, release: 0.05, chiff: 1.4, tongue: 1, glide: 0.012, gain: 0.75,
      body: [
        { type: 'highpass', freq: 300, q: 0.6 },
        { type: 'peaking', freq: 3000, q: 1, gain: 3 },
        { type: 'highshelf', freq: 6000, gain: 1.5 },
      ],
    },
  },
  fingering: holesLookup(tinWhistleFingerings),
  notes: (root) => tableNotes(tinWhistleFingerings, root),
  range: (root) => range(tableNotes(tinWhistleFingerings, root)),
  layoutBase: (root) => root,
};

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  concert: CONCERT,
  bansuri: BANSURI,
  recorder: RECORDER,
  whistle: WHISTLE,
};

export const INSTRUMENT_ORDER: InstrumentId[] = ['concert', 'bansuri', 'recorder', 'whistle'];

/** Timbre adjusted for the chosen key (the upper-register tone starts an octave above the root). */
export function timbreFor(inst: Instrument, root: number): Timbre {
  const customSet = `${inst.id}:${root}`;
  if (inst.id === 'bansuri' || inst.id === 'whistle') return { ...inst.timbre, registerBreak: root + 12, customSet };
  return { ...inst.timbre, customSet };
}

export function rootFor(inst: Instrument, key: number | undefined): number {
  if (key === undefined) return inst.defaultKey;
  return inst.keyOptions.some((k) => k.root === key) ? key : inst.defaultKey;
}

/** The tonic used for note names: Sa on bansuri, the whistle's key, C otherwise. */
export function tonicOf(inst: Instrument, root: number): number {
  return inst.id === 'bansuri' || inst.id === 'whistle' ? root : 60;
}

function patternKey(f: Fingering): string {
  return f.kind === 'keys' ? [...f.f.keys].sort().join('+') : f.f.holes.join('');
}

export interface FingerMatch {
  midi: number;
  exact: boolean;
}

/**
 * Reverse lookup for "Fingers" play mode: given what the player is covering, which note sounds?
 * Exact matches (primary or alternate fingerings) win; `overblow` picks the register among them.
 * Otherwise, the first open hole from the top decides, as on a real simple-system flute.
 */
export function noteFromFingers(
  inst: Instrument, root: number, pressed: { holes?: number[]; keys?: string[] }, overblow: number,
): FingerMatch | null {
  const want = pressed.keys ? [...pressed.keys].sort().join('+') : (pressed.holes ?? []).join('');
  const candidates: number[] = [];
  for (const m of inst.notes(root)) {
    const f = inst.fingering(m, root);
    if (!f) continue;
    const pats = [patternKey(f), ...f.alternates.map((a) => patternKey({ ...f, f: a } as Fingering))];
    if (pats.includes(want)) candidates.push(m);
  }
  if (candidates.length) {
    return { midi: candidates[Math.min(overblow, candidates.length - 1)], exact: true };
  }
  if (!pressed.holes || inst.holeCount === 0) return null;
  // Nearest fingering by weighted difference (top holes matter most).
  let best: number | null = null, bestScore = Infinity;
  const register = overblow + 1;
  for (const m of inst.notes(root)) {
    const f = inst.fingering(m, root);
    if (!f || f.kind !== 'holes') continue;
    let score = Math.abs(f.f.register - register) * 3;
    f.f.holes.forEach((h, i) => (score += Math.abs(h - (pressed.holes![i] ?? 0)) * (inst.holeCount - i)));
    if (score < bestScore) { bestScore = score; best = m; }
  }
  return best === null ? null : { midi: best, exact: false };
}
