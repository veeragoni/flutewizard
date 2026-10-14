import { estimateKey } from './theory';

export type ImportFormat = 'letters' | 'sargam' | 'abc' | 'midi' | 'musicxml';

export interface SongNote {
  /** MIDI pitch, or null for a rest. */
  midi: number | null;
  /** Start time in quarter-note beats from the beginning of the song. */
  start: number;
  /** Duration in quarter-note beats. */
  dur: number;
  /** Words sung under this note, when the source had them. */
  lyric?: string;
}

export interface SongSection {
  name: string;
  start: number;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  /** Time signature, e.g. [3, 4]. */
  time: [number, number];
  notes: SongNote[];
  sections: SongSection[];
  /** Lines of words that were kept for display under the music. */
  lyrics?: { start: number; text: string }[];
  /** Tonic pitch class (0 = C) and mode, detected or given. */
  tonic: number;
  mode: 'major' | 'minor';
  /** Sa as a MIDI note, for sargam display; defaults to tonic in octave 4. */
  sa?: number;
  source?: { format: ImportFormat; text: string };
  builtin?: boolean;
  tags?: string[];
  /** Short description shown on the song card. */
  blurb?: string;
  /** Suggested backing: drum groove id and whether to sound a drone. */
  groove?: string;
  drone?: boolean;
  /** Semitones the player chose to move the song by (saved with the song). */
  transpose?: number;
  updatedAt?: number;
}

export interface ParseWarning {
  line: number;
  message: string;
  /** Not a problem, just how something was read. */
  info?: boolean;
}

export interface ParseResult {
  song: Song;
  warnings: ParseWarning[];
  skippedLines: number[];
}

export const barLength = (time: [number, number]) => (time[0] * 4) / time[1];

export function songLength(song: Song): number {
  let end = 0;
  for (const n of song.notes) end = Math.max(end, n.start + n.dur);
  return end;
}

export function barCount(song: Song): number {
  return Math.max(1, Math.ceil(songLength(song) / barLength(song.time) - 1e-6));
}

export function pitchRange(song: Song): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (const n of song.notes) {
    if (n.midi === null) continue;
    lo = Math.min(lo, n.midi);
    hi = Math.max(hi, n.midi);
  }
  return lo === Infinity ? null : [lo, hi];
}

/**
 * Octave shift that best fits the song inside [lo, hi]; returns a multiple of 12.
 * Prefers no shift when the song already fits.
 */
export function fitOctave(song: Song, lo: number, hi: number): number {
  const r = pitchRange(song);
  if (!r) return 0;
  let best = 0, bestOut = Infinity;
  for (let s = -36; s <= 36; s += 12) {
    let out = 0;
    for (const n of song.notes) {
      if (n.midi === null) continue;
      const m = n.midi + s;
      if (m < lo) out += lo - m;
      else if (m > hi) out += m - hi;
    }
    if (out < bestOut || (out === bestOut && Math.abs(s) < Math.abs(best))) {
      best = s;
      bestOut = out;
    }
  }
  return best;
}

export function transposeSong(song: Song, semis: number): Song {
  if (!semis) return song;
  return {
    ...song,
    notes: song.notes.map((n) => (n.midi === null ? n : { ...n, midi: n.midi + semis })),
    tonic: (((song.tonic + semis) % 12) + 12) % 12,
    sa: song.sa !== undefined ? song.sa + semis : undefined,
  };
}

export function detectKey(song: Song): Pick<Song, 'tonic' | 'mode'> {
  const pitched = song.notes.filter((n): n is SongNote & { midi: number } => n.midi !== null);
  if (!pitched.length) return { tonic: 0, mode: 'major' };
  return estimateKey(pitched);
}

/** Notes grouped into bars, splitting nothing — a note belongs to the bar it starts in. */
export function notesByBar(song: Song): SongNote[][] {
  const len = barLength(song.time);
  const bars: SongNote[][] = Array.from({ length: barCount(song) }, () => []);
  for (const n of song.notes) bars[Math.min(bars.length - 1, Math.floor(n.start / len + 1e-6))].push(n);
  return bars;
}

export function newId(prefix = 'song'): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptySong(): Song {
  return {
    id: newId(),
    title: 'Untitled',
    bpm: 90,
    time: [4, 4],
    notes: [],
    sections: [],
    tonic: 0,
    mode: 'major',
  };
}
