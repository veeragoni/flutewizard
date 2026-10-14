import { engine, noiseBuffer } from './engine';
import { midiToFreq, pc } from '../music/theory';
import { barLength, type Song } from '../music/song';

/* ───────────────────────── Drum sounds (synthesized) ───────────────────────── */

export type DrumSound =
  | 'kick' | 'snare' | 'hat' | 'openhat' | 'rim' | 'shaker' | 'clap'
  | 'bodhran' | 'bodhranHi'
  | 'na' | 'tin' | 'tu' | 'ge' | 'ke';

function env(g: GainNode, when: number, peak: number, decay: number, attack = 0.002) {
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.setTargetAtTime(0.0001, when + attack, decay / 4);
}

function tone(when: number, f0: number, f1: number, sweep: number, decay: number, peak: number, out: AudioNode, type: OscillatorType = 'sine') {
  const ctx = engine.ctx;
  const o = new OscillatorNode(ctx, { type, frequency: f0 });
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + sweep);
  const g = new GainNode(ctx, { gain: 0 });
  env(g, when, peak, decay);
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + decay * 1.6 + 0.05);
}

function noise(when: number, type: BiquadFilterType, freq: number, q: number, decay: number, peak: number, out: AudioNode) {
  const ctx = engine.ctx;
  const s = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx) });
  const f = new BiquadFilterNode(ctx, { type, frequency: freq, Q: q });
  const g = new GainNode(ctx, { gain: 0 });
  env(g, when, peak, decay, 0.001);
  s.connect(f).connect(g).connect(out);
  s.start(when, Math.random() * 1.5);
  s.stop(when + decay * 1.6 + 0.05);
}

/** `tabla` is the dayan's pitch (tuned to Sa). */
export function playDrum(sound: DrumSound, when: number, vel: number, out: AudioNode, tabla = 261.6) {
  const v = vel;
  switch (sound) {
    case 'kick':
      tone(when, 140, 45, 0.09, 0.32, 0.9 * v, out);
      noise(when, 'lowpass', 1200, 0.7, 0.01, 0.15 * v, out);
      break;
    case 'snare':
      tone(when, 210, 160, 0.05, 0.12, 0.35 * v, out, 'triangle');
      noise(when, 'bandpass', 3500, 0.8, 0.16, 0.45 * v, out);
      break;
    case 'hat': noise(when, 'highpass', 8000, 0.7, 0.04, 0.22 * v, out); break;
    case 'openhat': noise(when, 'highpass', 7500, 0.7, 0.22, 0.2 * v, out); break;
    case 'shaker': noise(when, 'bandpass', 6500, 1.2, 0.05, 0.16 * v, out); break;
    case 'rim':
      tone(when, 1700, 1600, 0.01, 0.03, 0.25 * v, out, 'square');
      noise(when, 'bandpass', 2500, 3, 0.02, 0.2 * v, out);
      break;
    case 'clap':
      for (const d of [0, 0.011, 0.022]) noise(when + d, 'bandpass', 1400, 1.5, 0.05, 0.3 * v, out);
      noise(when + 0.03, 'bandpass', 1400, 1.2, 0.18, 0.25 * v, out);
      break;
    case 'bodhran':
      tone(when, 110, 70, 0.08, 0.28, 0.7 * v, out);
      noise(when, 'lowpass', 900, 0.8, 0.05, 0.2 * v, out);
      break;
    case 'bodhranHi':
      tone(when, 190, 150, 0.05, 0.14, 0.4 * v, out);
      noise(when, 'bandpass', 1800, 1, 0.03, 0.15 * v, out);
      break;
    // Tabla. Dayan strokes ring at the tuned pitch with the skin's overtones (~2x, ~3x, ~4x).
    case 'na':
      for (const [h, a] of [[1, 0.5], [2, 0.3], [3, 0.18], [4, 0.1]]) tone(when, tabla * h, tabla * h, 0.01, 0.35 / h + 0.08, a * v, out);
      noise(when, 'bandpass', 3000, 2, 0.015, 0.2 * v, out);
      break;
    case 'tin':
      for (const [h, a] of [[1, 0.35], [2, 0.12], [3, 0.08]]) tone(when, tabla * h, tabla * h, 0.01, 0.2 / h + 0.05, a * v, out);
      break;
    case 'tu':
      tone(when, tabla, tabla, 0.01, 0.6, 0.55 * v, out);
      tone(when, tabla * 2, tabla * 2, 0.01, 0.25, 0.12 * v, out);
      break;
    case 'ge':
      // Bayan: low, with the characteristic upward glide from wrist pressure.
      tone(when, 85, 120, 0.25, 0.55, 0.75 * v, out);
      noise(when, 'lowpass', 400, 0.7, 0.03, 0.15 * v, out);
      break;
    case 'ke':
      noise(when, 'lowpass', 600, 0.8, 0.03, 0.35 * v, out);
      tone(when, 120, 80, 0.02, 0.04, 0.3 * v, out);
      break;
  }
}

/* ─────────────────────────────── Grooves ─────────────────────────────── */

export interface Groove {
  id: string;
  label: string;
  group: 'Western' | 'Folk' | 'Indian';
  /** Time signatures the groove suits, e.g. "4/4". */
  fits: string[];
  stepsPerBeat: number; // per quarter note
  length: number; // steps before the pattern repeats
  hits: [step: number, sound: DrumSound, vel: number][];
}

function lanes(lines: Partial<Record<DrumSound, string>>): Groove['hits'] {
  const hits: Groove['hits'] = [];
  for (const [sound, pat] of Object.entries(lines) as [DrumSound, string][]) {
    [...pat.replace(/\s/g, '')].forEach((c, i) => {
      if (c === 'x') hits.push([i, sound, 0.8]);
      else if (c === 'X') hits.push([i, sound, 1]);
      else if (c === 'g') hits.push([i, sound, 0.35]);
    });
  }
  return hits;
}

const BOL: Record<string, DrumSound[]> = {
  Dha: ['na', 'ge'], Dhin: ['tin', 'ge'], Dhi: ['tin', 'ge'], Ge: ['ge'], Ghe: ['ge'], Na: ['na'], Ta: ['na'],
  Tin: ['tin'], Ti: ['tin'], Tu: ['tu'], Ka: ['ke'], Ke: ['ke'], Te: ['tin'], '-': [],
};

function bols(seq: string, accentEvery = 0): Groove['hits'] {
  const hits: Groove['hits'] = [];
  seq.split(/\s+/).filter(Boolean).forEach((b, i) => {
    const vel = accentEvery && i % accentEvery === 0 ? 1 : 0.75;
    for (const s of BOL[b] ?? []) hits.push([i, s, vel]);
  });
  return hits;
}

export const GROOVES: Groove[] = [
  { id: 'pop', label: 'Pop', group: 'Western', fits: ['4/4', '2/4'], stepsPerBeat: 4, length: 16,
    hits: lanes({ kick: 'X... .... x.x. ....', snare: '.... X... .... X...', hat: 'x.x. x.x. x.x. x.x.' }) },
  { id: 'ballad', label: 'Ballad', group: 'Western', fits: ['4/4'], stepsPerBeat: 4, length: 16,
    hits: lanes({ kick: 'X... .... x... ....', rim: '.... x... .... x...', shaker: 'g.x. g.x. g.x. g.x.' }) },
  { id: 'rock', label: 'Rock', group: 'Western', fits: ['4/4'], stepsPerBeat: 2, length: 8,
    hits: lanes({ kick: 'X..x x...', snare: '..X. ..X.', hat: 'xxxx xxxx' }) },
  { id: 'waltz', label: 'Waltz', group: 'Western', fits: ['3/4'], stepsPerBeat: 1, length: 3,
    hits: lanes({ kick: 'X..', hat: '.xx', rim: '.gg' }) },
  { id: 'bossa', label: 'Bossa nova', group: 'Western', fits: ['4/4', '2/4'], stepsPerBeat: 4, length: 32,
    hits: lanes({ kick: 'X..x X..x X..x X..x X..x X..x X..x X..x', rim: 'x..x ..x. ..x. .x.. x..x ..x. .x.. x...', shaker: 'gxgx gxgx gxgx gxgx gxgx gxgx gxgx gxgx' }) },
  { id: 'march', label: 'March', group: 'Western', fits: ['4/4', '2/4'], stepsPerBeat: 4, length: 16,
    hits: lanes({ kick: 'X... .... X... ....', snare: '.... X.gg .... X.xx', hat: 'x... x... x... x...' }) },
  { id: 'reel', label: 'Reel (bodhrán)', group: 'Folk', fits: ['4/4', '2/2', '2/4'], stepsPerBeat: 4, length: 16,
    hits: lanes({ bodhran: 'X... x... X... x...', bodhranHi: '..x. ..x. ..x. ..xx' }) },
  { id: 'jig', label: 'Jig (bodhrán)', group: 'Folk', fits: ['6/8', '9/8', '12/8'], stepsPerBeat: 2, length: 6,
    hits: lanes({ bodhran: 'X..x..', bodhranHi: '.x..xx' }) },
  { id: 'slowair', label: 'Slow air', group: 'Folk', fits: ['3/4', '4/4', '6/8'], stepsPerBeat: 1, length: 4,
    hits: lanes({ bodhran: 'x...', shaker: '.g.g' }) },
  { id: 'keherwa', label: 'Keherwa (8 beats)', group: 'Indian', fits: ['4/4'], stepsPerBeat: 2, length: 8,
    hits: bols('Dha Ge Na Ti Na Ka Dhi Na', 4) },
  { id: 'bhajan', label: 'Bhajan (Keherwa)', group: 'Indian', fits: ['4/4'], stepsPerBeat: 2, length: 8,
    hits: bols('Dha - Dhin Na Tin - Dhin Na', 4) },
  { id: 'dadra', label: 'Dadra (6 beats)', group: 'Indian', fits: ['6/8', '3/4'], stepsPerBeat: 2, length: 6,
    hits: bols('Dha Dhi Na Dha Tu Na', 3) },
  { id: 'rupak', label: 'Rupak (7 beats)', group: 'Indian', fits: ['7/8', '7/4'], stepsPerBeat: 2, length: 7,
    hits: bols('Tin Tin Na Dhi Na Dhi Na') },
  { id: 'teentaal', label: 'Teentaal (16 beats)', group: 'Indian', fits: ['4/4'], stepsPerBeat: 1, length: 16,
    hits: bols('Dha Dhin Dhin Dha Dha Dhin Dhin Dha Dha Tin Tin Ta Ta Dhin Dhin Dha', 4) },
];

export function grooveFor(time: [number, number]): Groove {
  const sig = `${time[0]}/${time[1]}`;
  return GROOVES.find((g) => g.fits.includes(sig)) ?? GROOVES[0];
}

/* ───────────────────────────── Auto chords ───────────────────────────── */

export interface Chord {
  root: number; // pitch class
  minor: boolean;
  start: number; // beats
  dur: number;
}

const MAJOR_DEGREES: [number, boolean, number][] = [[0, false, 0.25], [2, true, 0], [4, true, -0.05], [5, false, 0.12], [7, false, 0.15], [9, true, 0.05]];
const MINOR_DEGREES: [number, boolean, number][] = [[0, true, 0.25], [3, false, 0.05], [5, true, 0.1], [7, false, 0.15], [8, false, 0.08], [10, false, 0.05]];

/** Picks one diatonic chord per bar (two per bar in long 4/4 bars when the melody clearly changes). */
export function harmonize(song: Song): Chord[] {
  const len = barLength(song.time);
  const end = song.notes.reduce((a, n) => Math.max(a, n.start + n.dur), 0);
  const bars = Math.max(1, Math.ceil(end / len - 1e-6));
  const degrees = song.mode === 'minor' ? MINOR_DEGREES : MAJOR_DEGREES;
  const chords: Chord[] = [];
  const split = len >= 4 && song.bpm < 140;
  const span = split ? len / 2 : len;
  const spans = Math.ceil(end / span - 1e-6);
  let prev: Chord | null = null;
  for (let s = 0; s < spans; s++) {
    const a = s * span, b = a + span;
    const weights = new Array(12).fill(0);
    let any = false;
    for (const n of song.notes) {
      if (n.midi === null) continue;
      const lo = Math.max(a, n.start), hi = Math.min(b, n.start + n.dur);
      if (hi <= lo) continue;
      any = true;
      const strong = Math.abs(n.start - a) < 1e-6 ? 1.6 : Math.abs(((n.start - a) % 1)) < 1e-6 ? 1.15 : 1;
      weights[pc(n.midi)] += (hi - lo) * strong;
    }
    if (!any && prev) {
      prev.dur += span;
      continue;
    }
    let best = degrees[0], bestScore = -Infinity;
    for (const d of degrees) {
      const root = (song.tonic + d[0]) % 12;
      const tones = [root, (root + (d[1] ? 3 : 4)) % 12, (root + 7) % 12];
      let score = d[2];
      for (let p = 0; p < 12; p++) score += weights[p] * (tones.includes(p) ? (p === root ? 1.2 : 1) : -0.45);
      if (s === 0 || s === spans - 1) score += d[0] === 0 ? 0.6 : 0;
      if (prev && prev.root === root) score += 0.15; // mild preference for fewer changes
      if (score > bestScore) { bestScore = score; best = d; }
    }
    const root = (song.tonic + best[0]) % 12;
    if (prev && prev.root === root && prev.minor === best[1]) prev.dur += span;
    else {
      prev = { root, minor: best[1], start: a, dur: span };
      chords.push(prev);
    }
  }
  void bars;
  return chords;
}

/* ───────────────────────── Bass and pad (strings) ───────────────────────── */

export function playBass(midi: number, when: number, dur: number, out: AudioNode) {
  const ctx = engine.ctx;
  const f = midiToFreq(midi);
  const o1 = new OscillatorNode(ctx, { type: 'triangle', frequency: f });
  const o2 = new OscillatorNode(ctx, { type: 'sine', frequency: f / 2 });
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 900, Q: 0.8 });
  lp.frequency.setValueAtTime(1400, when);
  lp.frequency.setTargetAtTime(500, when, 0.12);
  const g = new GainNode(ctx, { gain: 0 });
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.42, when + 0.01);
  g.gain.setTargetAtTime(0.22, when + 0.01, 0.2);
  g.gain.setTargetAtTime(0.0001, when + dur * 0.92, 0.06);
  o1.connect(lp);
  o2.connect(new GainNode(ctx, { gain: 0.5 })).connect(lp);
  lp.connect(g).connect(out);
  for (const o of [o1, o2]) { o.start(when); o.stop(when + dur + 0.4); }
}

export function playPad(chord: Chord, when: number, dur: number, out: AudioNode) {
  const ctx = engine.ctx;
  // Close voicing between G3 and G4.
  const base = 55 + ((chord.root - 7 + 12) % 12);
  const notes = [base, base + (chord.minor ? 3 : 4), base + 7];
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1100, Q: 0.4 });
  const g = new GainNode(ctx, { gain: 0 });
  const attack = Math.min(0.5, dur * 0.3);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.07, when + attack);
  g.gain.setTargetAtTime(0.0001, when + dur - 0.05, 0.15);
  lp.connect(g).connect(out);
  for (const m of notes) {
    for (const det of [-7, 6]) {
      const o = new OscillatorNode(ctx, { type: 'sawtooth', frequency: midiToFreq(m), detune: det });
      o.connect(lp);
      o.start(when);
      o.stop(when + dur + 0.8);
    }
  }
}

/* ─────────────────────────────── Metronome ─────────────────────────────── */

export function playClick(when: number, accent: boolean, out: AudioNode) {
  const ctx = engine.ctx;
  const o = new OscillatorNode(ctx, { type: 'sine', frequency: accent ? 1760 : 1175 });
  const g = new GainNode(ctx, { gain: 0 });
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + 0.06);
}
