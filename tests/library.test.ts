import { describe, expect, it } from 'vitest';
import { builtinSongs } from '../src/songs/library';
import { barLength, songLength } from '../src/music/song';

describe('built-in library', () => {
  for (const s of builtinSongs()) {
    it(`${s.title} parses into whole bars`, () => {
      expect(s.notes.filter((n) => n.midi !== null).length).toBeGreaterThan(5);
      const bl = barLength(s.time);
      const end = songLength(s);
      const first = s.notes[0].start;
      const offBar = (x: number) => Math.min(x % bl, bl - (x % bl));
      // Either the song ends on a bar line, or its last bar is short by exactly the pickup.
      expect(Math.min(offBar(end), offBar(end - first))).toBeLessThan(0.01);
    });
  }
});
