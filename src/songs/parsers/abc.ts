import { LETTER_TO_PC } from '../../music/theory';
import { alignPickup } from './text';
import { emptySong, type ParseResult, type ParseWarning, type SongNote } from '../../music/song';

/**
 * ABC notation (abcnotation.com), the format most folk, Irish and flute/whistle tune libraries use.
 * Supports headers X T C M L Q K, accidentals, octaves, lengths, broken rhythm, ties, triplets,
 * chords (melody = top note), repeats with first/second endings, inline fields and w: lyrics.
 * Only the first tune in a file is read.
 */

const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};
const MODE_SHIFT: Record<string, number> = {
  '': 0, maj: 0, ion: 0, mix: -1, dor: -2, m: -3, min: -3, aeo: -3, phr: -4, loc: -5, lyd: 1,
};
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

interface KeyInfo {
  tonic: number;
  mode: 'major' | 'minor';
  acc: Record<string, number>;
}

export function parseAbcKey(k: string): KeyInfo | null {
  const s = k.trim();
  if (!s || /^none|^hp/i.test(s)) return { tonic: 0, mode: 'major', acc: {} };
  const m = /^([A-G])([#b]?)\s*([a-zA-Z]*)/.exec(s);
  if (!m) return null;
  const tonicName = m[1] + m[2];
  const modeWord = m[3].toLowerCase();
  const modeKey = modeWord === 'm' ? 'm' : modeWord.slice(0, 3);
  if (!(modeKey in MODE_SHIFT)) return null;
  // Fifths of the mode's tonic as if major, then shift for the mode.
  const tonicPc = (LETTER_TO_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  let fifths = MAJOR_FIFTHS[tonicName];
  if (fifths === undefined) {
    // Enharmonic spelling not in the table (e.g. A#): find it by pitch class.
    fifths = Object.entries(MAJOR_FIFTHS).find(([n]) =>
      (LETTER_TO_PC[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0) + 12) % 12 === tonicPc)![1];
  }
  fifths += MODE_SHIFT[modeKey];
  const acc: Record<string, number> = {};
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((l) => (acc[l] = 1));
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((l) => (acc[l] = -1));
  const minorish = ['m', 'min', 'aeo', 'dor', 'phr', 'loc'].includes(modeKey);
  return { tonic: tonicPc, mode: minorish ? 'minor' : 'major', acc };
}

function parseFrac(s: string): number | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s);
  return m ? parseInt(m[1], 10) / parseInt(m[2], 10) : null;
}

function parseMeter(s: string): [number, number] | null {
  const t = s.trim();
  if (t === 'C') return [4, 4];
  if (t === 'C|') return [2, 2];
  const m = /^(\d+)\s*\/\s*(\d+)/.exec(t);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

type Tok =
  | { k: 'note'; midi: number | null; len: number; line: number; tieAfter?: boolean }
  | { k: 'bar' }
  | { k: 'repStart' }
  | { k: 'repEnd' }
  | { k: 'ending'; n: number }
  | { k: 'end' }
  | { k: 'lyrics'; text: string };

export function parseAbc(text: string): ParseResult {
  const song = emptySong();
  song.source = { format: 'abc', text };
  const warnings: ParseWarning[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let unitL: number | null = null;
  let key: KeyInfo = { tonic: 0, mode: 'major', acc: {} };
  let inBody = false;
  let tuneCount = 0;
  let qBpm: number | null = null;
  const toks: Tok[] = [];

  // Per-line parse state for the body.
  let barAcc: Record<string, number> = {};
  let broken = 1; // multiplier to apply to the next note from > or <
  let tuplet: { left: number; factor: number } | null = null;

  const noteKey = (letter: string, octave: number) => letter + octave;

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1;
    const line = lines[li].replace(/%.*$/, '');
    if (!line.trim()) {
      if (inBody && tuneCount === 1) inBody = false;
      continue;
    }
    const field = /^([A-Za-z]):\s*(.*)$/.exec(line);
    if (field && (!inBody || /^[KLMQPTWw]$/.test(field[1]))) {
      const [, f, val] = field;
      if (f === 'X') {
        tuneCount++;
        if (tuneCount > 1) {
          warnings.push({ line: lineNo, message: 'This file has more than one tune; only the first was read.' });
          break;
        }
        continue;
      }
      if (tuneCount > 1) break;
      switch (f) {
        case 'T': if (song.title === 'Untitled') song.title = val.trim(); break;
        case 'C': song.artist = val.trim(); break;
        case 'M': { const m = parseMeter(val); if (m) song.time = m; break; }
        case 'L': { const v = parseFrac(val); if (v) unitL = v; break; }
        case 'Q': {
          const m = /(?:(\d+\/\d+)\s*=\s*)?(\d+)/.exec(val);
          if (m) {
            const beat = m[1] ? parseFrac(m[1])! : 0.25;
            qBpm = parseInt(m[2], 10) * beat * 4;
          }
          break;
        }
        case 'K': {
          const k = parseAbcKey(val);
          if (k) key = k;
          else warnings.push({ line: lineNo, message: `Key "${val}" not understood; using C major.` });
          if (!inBody) inBody = true;
          break;
        }
        case 'w': case 'W': toks.push({ k: 'lyrics', text: val.trim() }); break;
      }
      continue;
    }
    if (!inBody) continue;

    if (unitL === null) {
      const [n, d] = song.time;
      unitL = n / d < 0.75 ? 1 / 16 : 1 / 8;
    }

    let i = 0;
    const s = line;
    const peek = (o = 0) => s[i + o] ?? '';
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '`' || c === '\\') { i++; continue; }
      if (c === '"') { const j = s.indexOf('"', i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '!' || c === '+') { const j = s.indexOf(c, i + 1); i = j < 0 ? i + 1 : j + 1; continue; }
      if (c === '{') { const j = s.indexOf('}', i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if ('~.HLMOPSTuv'.includes(c) && !/[A-Ga-gz]/.test(c)) { i++; continue; }
      if (c === '[' && /[A-Za-z]:/.test(s.slice(i + 1, i + 3))) {
        const j = s.indexOf(']', i);
        const inner = s.slice(i + 1, j < 0 ? s.length : j);
        const f = inner[0], val = inner.slice(2);
        if (f === 'K') { const k = parseAbcKey(val); if (k) key = k; }
        if (f === 'L') { const v = parseFrac(val); if (v) unitL = v; }
        if (f === 'M') { const m = parseMeter(val); if (m) song.time = m; }
        i = j < 0 ? s.length : j + 1;
        continue;
      }
      // Bar lines, repeats and endings.
      if (c === '|' || c === ':' || (c === '[' && /[|\d]/.test(peek(1)))) {
        const m = /^(:*)(\[?\|*\]?)(:*)\s*\[?(\d)?/.exec(s.slice(i))!;
        const raw = m[0];
        if (!raw.trim()) { i++; continue; }
        if (m[1]) toks.push({ k: 'repEnd' });
        if (m[1].length >= 2 && !m[2] && !m[3]) toks.push({ k: 'repStart' });
        if (m[2].includes('|') || m[2] === '[' || m[2] === '') toks.push({ k: 'bar' });
        if (m[2].includes(']') && !m[3]) toks.push({ k: 'end' });
        if (m[3]) toks.push({ k: 'repStart' });
        if (m[4]) toks.push({ k: 'ending', n: parseInt(m[4], 10) });
        barAcc = {};
        i += raw.length;
        // Skip ",2" in endings like [1,2.
        while (/[,\d-]/.test(peek())) i++;
        continue;
      }
      if (c === '(' && /\d/.test(peek(1))) {
        const m = /^\((\d)(?::(\d)?)?(?::(\d))?/.exec(s.slice(i))!;
        const p = parseInt(m[1], 10);
        const q = m[2] ? parseInt(m[2], 10) : ({ 2: 3, 3: 2, 4: 3, 6: 2, 8: 3 } as Record<number, number>)[p] ?? 2;
        const r = m[3] ? parseInt(m[3], 10) : p;
        tuplet = { left: r, factor: q / p };
        i += m[0].length;
        continue;
      }
      if (c === '(' || c === ')') { i++; continue; }
      if (c === '>' || c === '<') {
        let n = 0;
        while (peek() === c) { n++; i++; }
        const prev = [...toks].reverse().find((t) => t.k === 'note') as Extract<Tok, { k: 'note' }> | undefined;
        const dot = 1 - Math.pow(0.5, n);
        if (prev) prev.len *= c === '>' ? 1 + dot : 1 - dot;
        broken = c === '>' ? 1 - dot : 1 + dot;
        continue;
      }
      if (c === '-') {
        const prev = [...toks].reverse().find((t) => t.k === 'note') as Extract<Tok, { k: 'note' }> | undefined;
        if (prev) prev.tieAfter = true;
        i++;
        continue;
      }

      // Notes, rests and chords.
      let chordNotes: (number | null)[] = [];
      if (c === '[') {
        i++;
        while (i < s.length && s[i] !== ']') {
          const n = readPitch();
          if (n === undefined) i++;
          else { chordNotes.push(n); readLength(); }
        }
        i++;
      } else {
        const n = readPitch();
        if (n === undefined) {
          if (!/\s/.test(c)) warnings.push({ line: lineNo, message: `"${c}" not understood; skipped.` });
          i++;
          continue;
        }
        chordNotes = [n];
      }
      const len = readLength();
      if (c === 'Z') {
        toks.push({ k: 'note', midi: null, len: (song.time[0] / song.time[1]) * len, line: lineNo });
        continue;
      }
      const pitched = chordNotes.filter((x): x is number => x !== null);
      const midi = pitched.length ? Math.max(...pitched) : null;
      let L = unitL! * len * broken;
      broken = 1;
      if (tuplet) {
        L *= tuplet.factor;
        if (--tuplet.left <= 0) tuplet = null;
      }
      toks.push({ k: 'note', midi, len: L, line: lineNo });
    }

    // Reads accidentals + letter + octave marks; returns MIDI, null for a rest, undefined when not a note.
    function readPitch(): number | null | undefined {
      const start = i;
      let acc: number | null = null;
      while (s[i] === '^' || s[i] === '_' || s[i] === '=') {
        acc = (acc ?? 0) + (s[i] === '^' ? 1 : s[i] === '_' ? -1 : 0);
        if (s[i] === '=') acc = 0;
        i++;
      }
      const L = s[i];
      if (L === 'z' || L === 'x' || L === 'Z' || L === 'X') {
        i++;
        return null;
      }
      if (!L || !/[A-Ga-g]/.test(L)) {
        i = start;
        return undefined;
      }
      i++;
      let octave = L === L.toLowerCase() ? 5 : 4;
      while (s[i] === "'" || s[i] === ',') { octave += s[i] === "'" ? 1 : -1; i++; }
      const letter = L.toUpperCase();
      const k = noteKey(letter, octave);
      if (acc !== null) barAcc[k] = acc;
      const a = barAcc[k] ?? key.acc[letter] ?? 0;
      return (octave + 1) * 12 + LETTER_TO_PC[letter] + a;
    }
    function readLength(): number {
      const m = /^(\d*)(\/*)(\d*)/.exec(s.slice(i))!;
      i += m[0].length;
      let v = m[1] ? parseInt(m[1], 10) : 1;
      if (m[2]) {
        if (m[3]) v /= parseInt(m[3], 10) * Math.pow(2, m[2].length - 1);
        else v /= Math.pow(2, m[2].length);
      }
      return v;
    }
  }

  // Expand repeats into a flat timeline.
  const notes: SongNote[] = [];
  const lyrics: { start: number; text: string }[] = [];
  let t = 0;
  let repStart = 0;
  const taken = new Set<number>();
  let secondPass = false;
  let guard = 0;
  let firstBarAt: number | null = null;
  for (let i = 0; i < toks.length && guard++ < 100000; i++) {
    const tk = toks[i];
    if (tk.k === 'repStart') { repStart = i + 1; secondPass = false; continue; }
    if (tk.k === 'repEnd') {
      if (!taken.has(i)) {
        taken.add(i);
        secondPass = true;
        i = repStart - 1;
        continue;
      }
      secondPass = false;
      repStart = i + 1;
      continue;
    }
    if (tk.k === 'ending' && tk.n === 1 && secondPass) {
      // Skip the first ending on the second time through.
      let j = i + 1;
      while (j < toks.length && !(toks[j].k === 'ending' && (toks[j] as { n: number }).n !== 1)) j++;
      i = j - 1;
      secondPass = false;
      continue;
    }
    if (tk.k === 'bar' && firstBarAt === null && t > 0) firstBarAt = t;
    if (tk.k === 'lyrics') { lyrics.push({ start: lastLineStart(notes, t), text: tk.text }); continue; }
    if (tk.k !== 'note') continue;
    const dur = tk.len * 4;
    const prev = notes[notes.length - 1];
    if (prev && prev.midi !== null && prev.midi === tk.midi && (prev as SongNote & { tie?: boolean }).tie) {
      prev.dur += dur;
      (prev as SongNote & { tie?: boolean }).tie = tk.tieAfter;
    } else {
      const n: SongNote & { tie?: boolean } = { midi: tk.midi, start: t, dur };
      if (tk.tieAfter) n.tie = true;
      notes.push(n);
    }
    t += dur;
  }
  for (const n of notes) delete (n as SongNote & { tie?: boolean }).tie;

  song.notes = notes;
  song.lyrics = lyrics.length ? lyrics : undefined;
  alignPickup(song, firstBarAt);
  song.tonic = key.tonic;
  song.mode = key.mode;
  song.sa = 60 + key.tonic;
  const [n, d] = song.time;
  // Default tempo: a lively dance pace in compound time, moderate otherwise.
  song.bpm = Math.round(qBpm ?? (d === 8 && n % 3 === 0 ? 180 : 100));
  if (!notes.some((x) => x.midi !== null)) {
    warnings.push({ line: 0, message: 'No notes found. ABC tunes need a K: line before the notes.' });
  }
  return { song, warnings, skippedLines: [] };
}

function lastLineStart(notes: SongNote[], t: number): number {
  return notes.length ? notes[Math.max(0, notes.length - 8)].start : t;
}

export function looksLikeAbc(text: string): boolean {
  return /^\s*K:/m.test(text) && /^\s*(X|T|M|L):/m.test(text);
}
