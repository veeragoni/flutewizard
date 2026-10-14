import { describe, expect, it } from 'vitest';
import { detectTextFormat, parseSongText } from '../src/songs/parsers';
import { fluteSa, parseSwaraSet } from '../src/songs/parsers/text';

const rel = (t: string) => {
  const r = parseSongText(t);
  const sa = r.song.sa!;
  return { r, p: r.song.notes.filter((n) => n.midi !== null).map((n) => n.midi! - sa), d: r.song.notes.map((n) => n.dur) };
};

describe('song sheets pasted from web sites', () => {
  const SHEET = [
    'Flute used for notations : G#', '', 'Flute Music:', 'S R G | M P (x2)', '',
    'Violins Music:', 'S PM… gRg (x2)', '', '(A note to the reader about apostrophes)', '',
    '==========', 'OPTION 2:', 'Flute used for notations : D', 'G G | G G – G',
  ].join('\n');

  it('reads the flute line, plays one version and skips other instruments', () => {
    const { r, p } = rel(SHEET);
    expect(r.song.sa).toBe(68); // G#4
    expect(r.song.sections.map((s) => s.name)).toEqual(['Flute Music']);
    expect(p).toEqual([0, 2, 4, 5, 7, 0, 2, 4, 5, 7]); // (x2) repeats the line
    expect(r.warnings.map((w) => w.message).join(' ')).toMatch(/second version starts at line 11.*Violins Music/s);
    expect(r.song.lyrics ?? []).toEqual([]); // headings and notes-to-reader aren't lyrics
  });

  it('knows the usual bansuri sizes', () => {
    expect([fluteSa('G#'), fluteSa('E'), fluteSa('C'), fluteSa('G bass'), fluteSa('A'), fluteSa('F# middle'), fluteSa('C#5')])
      .toEqual([68, 64, 72, 55, 69, 66, 73]);
  });
});

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

describe('notes written down from a video tutorial', () => {
  // Bombay theme as written under a YouTube flute lesson; pitches checked against the video's audio.
  const VIDEO = [
    '02:52| Dh Dh Dh Dh Dh^^Pa , Pa DhNi Dh NiSaNi, Dh PaDhPa maGamaRe',
    '',
    '{Note : inside this video,  half the notation is not of the first line, then it is given here}',
    '',
    "07:39| NiSaRe GaMa'PaMa'Pa DhSaDh^^Pa Ga..........GamaGama Re.......",
  ].join('\n');

  it('reads timestamps, syllables run together, carets as holds and ornaments', () => {
    expect(detectTextFormat(VIDEO)).toBe('sargam');
    const { r, p, d } = rel(VIDEO);
    expect(r.warnings).toEqual([]);
    expect(r.song.lyrics ?? []).toEqual([]); // the note in braces isn't a lyric
    expect(r.song.sections.map((s) => s.name)).toEqual(['02:52', '07:39']);
    expect(p).toEqual([
      9, 9, 9, 9, 9, 7, 7, 9, 11, 9, 11, 12, 11, 9, 7, 9, 7, 5, 4, 5, 2,
      // No octave marks: Sa after Ni goes up, Ni before Sa goes down. "ma" is shuddha, "Ma’" tivra.
      -1, 0, 2, 4, 6, 7, 6, 7, 9, 12, 9, 7, 4, 4, 5, 4, 5, 2,
    ]);
    expect(d.slice(4, 6)).toEqual([2, 1]); // Dh^^ held, then Pa
    expect(d.slice(10, 13)).toEqual([0.25, 0.25, 1]); // NiSaNi: two grace notes landing on Ni
  });

  it('repeats lines marked (2) and treats MUSIC as a section', () => {
    const { r, p } = rel('MUSIC\n\n09:45| RePaDh Pa......maGama (2)\n      RePaDh Sa.......Dh PamaPa(2)');
    expect(r.warnings).toEqual([]);
    expect(r.song.sections.map((s) => s.name)).toEqual(['MUSIC', '09:45']);
    const once = [2, 7, 9, 7, 5, 4, 5], twice = [2, 7, 9, 12, 9, 7, 5, 7];
    expect(p).toEqual([...once, ...once, ...twice, ...twice]);
  });

  it('leaves marked octaves to the writer', () => {
    expect(rel("S R G M P D N S'").p).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
    expect(rel('Sa Re Ga Ma Pa Dha Ni Sa').p).toEqual([0, 2, 4, 5, 7, 9, 11, 12]); // unmarked: Sa goes up
    expect(rel('Sa .Dha Pa Dha Sa').p).toEqual([0, -3, 7, 9, 0]); // the writer marks lower notes, so others stay
  });
});
