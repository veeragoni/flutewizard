import type { Instrument } from '../instruments';
import { fitOctave, transposeSong, type Song } from '../music/song';

/**
 * The song as it will sound on this flute: on a bansuri, Sargam songs move to the flute's Sa and
 * other songs move their home note to Sa (the nearest way), the way bansuri players read Western tunes.
 * Then the song's saved transposition plus any extra, then octaves so it sits inside the range.
 */
export function fitSong(s: Song, inst: Instrument, root: number, extra = 0): Song {
  let semis = s.transpose ?? 0;
  if (inst.naming === 'sargam') {
    if (s.source?.format === 'sargam') semis += root - (s.sa ?? 60);
    else {
      const d = (((root - s.tonic) % 12) + 12) % 12;
      semis += d > 6 ? d - 12 : d;
    }
  }
  let moved = transposeSong(s, semis + extra);
  const [lo, hi] = inst.range(root);
  // Bansuri and whistle tunes sit best in the lower, home octave (around Pa/the fifth).
  const center = inst.id === 'bansuri' || inst.id === 'whistle' ? root + 7 : undefined;
  moved = transposeSong(moved, fitOctave(moved, lo, hi, center));
  return moved;
}

export function hardNotes(s: Song, inst: Instrument, root: number): number {
  return s.notes.filter((n) => n.midi !== null && !inst.fingering(n.midi, root)).length;
}

/** Transposition in [-6, 6] that leaves the fewest unplayable notes (prefers small moves). */
export function bestTranspose(s: Song, inst: Instrument, root: number): { semis: number; hard: number } {
  let best = { semis: 0, hard: Infinity };
  for (const t of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) {
    const hard = hardNotes(fitSong({ ...s, transpose: 0 }, inst, root, t), inst, root);
    if (hard < best.hard) best = { semis: t, hard };
  }
  return best;
}
