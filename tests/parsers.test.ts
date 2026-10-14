import { describe, expect, it } from 'vitest';
import { parseSongText, detectTextFormat, songToText } from '../src/songs/parsers';
import { parseAbc } from '../src/songs/parsers/abc';
import { barLength, songLength } from '../src/music/song';

const pitches = (t: string, f?: 'letters' | 'sargam' | 'abc') =>
  parseSongText(t, f ?? 'auto').song.notes.filter((n) => n.midi !== null).map((n) => n.midi);

describe('letters', () => {
  it('parses notes, holds, halves and groups', () => {
    const { song } = parseSongText('C D- (E F) G/ G/', 'letters');
    expect(song.notes.map((n) => [n.midi, n.start, n.dur])).toEqual([
      [60, 0, 1], [62, 1, 2], [64, 3, 0.5], [65, 3.5, 0.5], [67, 4, 0.5], [67, 4.5, 0.5],
    ]);
  });
  it('treats word lines as lyrics', () => {
    const r = parseSongText('C D E\nTwinkle twinkle little star\nF G A', 'letters');
    expect(r.skippedLines).toEqual([2]);
    expect(r.song.lyrics?.[0].text).toBe('Twinkle twinkle little star');
    expect(pitches('C D E\nTwinkle twinkle little star\nF G A', 'letters')).toEqual([60, 62, 64, 65, 67, 69]);
  });
  it('splits C-D-E but keeps G-- as a held note', () => {
    expect(pitches('C-D-E G--', 'letters')).toEqual([60, 62, 64, 67]);
  });
  it('aligns a pickup bar', () => {
    const { song } = parseSongText('Time: 3/4\nG | C- E | G---', 'letters');
    expect(song.notes[0].start).toBe(2);
    expect(song.notes[1].start).toBe(3);
  });
});

describe('sargam', () => {
  it('reads syllables, komal, tivra and octaves', () => {
    expect(pitches('Sa Re Ga Ma Pa Dha Ni Sa\'', 'sargam')).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(pitches('Rek Ga(k) Ma# .Ni .Pa', 'sargam')).toEqual([61, 63, 66, 59, 55]);
  });
  it('uses case for komal when lowercase single letters appear', () => {
    expect(pitches('S r G m M P d N', 'sargam')).toEqual([60, 61, 64, 65, 66, 67, 68, 71]);
  });
  it('treats all-caps single letters as shuddha', () => {
    expect(pitches('S R G M P D N', 'sargam')).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });
  it('honours Sa:', () => {
    expect(pitches('Sa: E4\nSa Pa', 'sargam')).toEqual([64, 71]);
  });
  it('is detected automatically', () => {
    expect(detectTextFormat('Sa Re Ga Ma | Pa - - -')).toBe('sargam');
    expect(detectTextFormat('C D E F | G - - -')).toBe('letters');
    expect(detectTextFormat('X:1\nT:x\nK:G\nGAB|')).toBe('abc');
  });
});

describe('abc', () => {
  it('applies key signature, lengths and broken rhythm', () => {
    const { song } = parseAbc('X:1\nM:4/4\nL:1/8\nK:D\nf2 c>B |');
    expect(song.notes.map((n) => [n.midi, n.dur])).toEqual([[78, 1], [73, 0.75], [71, 0.25]]);
  });
  it('expands repeats with first and second endings', () => {
    const { song } = parseAbc('X:1\nL:1/4\nK:C\n|: C D |1 E F :|2 G A |]');
    expect(song.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 60, 62, 67, 69]);
  });
  it('handles ties, triplets and bar accidentals', () => {
    const { song } = parseAbc('X:1\nL:1/4\nK:C\n^F F =F | (3CDE G2- G2 |');
    expect(song.notes.map((n) => n.midi)).toEqual([66, 66, 65, 60, 62, 64, 67]);
    expect(song.notes[3].dur).toBeCloseTo(2 / 3);
    expect(song.notes[6].dur).toBe(4);
  });
});

describe('round trip', () => {
  it('songToText re-parses to the same notes', () => {
    const { song } = parseAbc('X:1\nM:6/8\nL:1/8\nK:G\nG3 GAB|A3 ABd|');
    const text = songToText(song, 'letters');
    const again = parseSongText(text, 'letters').song;
    expect(again.notes.map((n) => [n.midi, n.start, n.dur])).toEqual(song.notes.map((n) => [n.midi, n.start, n.dur]));
    const sargam = parseSongText(songToText(song, 'sargam'), 'sargam').song;
    expect(sargam.notes.map((n) => n.midi)).toEqual(song.notes.map((n) => n.midi));
  });
});

export { barLength, songLength };
