import { describe, expect, it } from 'vitest';
import { detectTextFormat, parseSongText } from '../src/songs/parsers';
import { parseSwaraSet } from '../src/songs/parsers/text';

const rel = (t: string) => {
  const r = parseSongText(t);
  const sa = r.song.sa!;
  return { r, p: r.song.notes.filter((n) => n.midi !== null).map((n) => n.midi! - sa), d: r.song.notes.map((n) => n.dur) };
};

describe('sargam as written on web sites', () => {
  it('reads notes run together, holds and glides, with lowercase komal notes', () => {
    const { r, p, d } = rel('P PP… | M g RgR…S\nD~S’ R’ g’ S’n’ | ,D,NS');
    expect(detectTextFormat('P PP… | M g RgR…S')).toBe('sargam');
    expect(r.warnings.filter((w) => !w.info)).toEqual([]);
    expect(p).toEqual([7, 7, 7, 5, 3, 2, 3, 2, 0, 9, 12, 14, 15, 12, 22, -3, -1, 0]);
    expect(d.slice(0, 3)).toEqual([1, 0.5, 1.5]); // P, then P P… (second one held)
  });

  it('keeps uppercase M as shuddha unless a lowercase m is used', () => {
    expect(rel('S R g M P').p).toEqual([0, 2, 3, 5, 7]);
    expect(rel('S R g m M P').p).toEqual([0, 2, 3, 5, 6, 7]);
  });

  it('works out whether ’ means the lower or upper octave from the melody', () => {
    // Writer uses ’ before notes for mandra and after notes for taar.
    const { p } = rel('G R S ’NS’N ’D | ’P ’D’N S R | D NS’R’G’ | G’R’S’ N D');
    expect(p).toEqual([4, 2, 0, -1, 0, -1, -3, -5, -3, -1, 0, 2, 9, 11, 12, 14, 16, 16, 14, 12, 11, 9]);
  });

  it('reads all-lowercase notes with a Notes: scale, dotted lower octave and capital upper octave', () => {
    const { r, p, d } = rel('Flute: F# middle\nNotes: s r2 g2 m1 p d2 n1\nr g rg s n.d.n.d. p.\nr g p.... nSR.....Snd p.. m g');
    expect(r.song.sa).toBe(66);
    expect(p).toEqual([2, 4, 2, 4, 0, -2, -3, -2, -3, -5, 2, 4, 7, 10, 12, 14, 12, 10, 9, 7, 5, 4]);
    expect(d[d.length - 3]).toBe(2); // "p.." is a beat plus a held beat
  });

  it('reads Carnatic swara numbers, falling back to 1 = komal, 2 = shuddha', () => {
    expect(parseSwaraSet('s r2 g3 m1 p d2 n3')!.scale).toMatchObject({ R: 2, G: 4, M: 5, D: 9, N: 11 });
    expect(parseSwaraSet('s r2 g2 m1 p d2 n2')!.scale).toMatchObject({ G: 3, N: 10 });
    expect(parseSwaraSet('s r2 g2 m1 p d2 n1')!.scale).toMatchObject({ G: 4, N: 10 });
    expect(parseSwaraSet('hello world')).toBeNull();
  });
});
