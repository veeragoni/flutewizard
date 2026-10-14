import type { Song } from '../music/song';
import { parseSongText, type TextFormat } from './parsers';

/**
 * Built-in tunes. Every melody here is public domain (traditional, or by composers who died
 * long ago) or an exercise. Written in the same text formats people can import, so the
 * library doubles as examples.
 */

interface Entry {
  id: string;
  format: TextFormat;
  tags: string[];
  blurb: string;
  groove?: string;
  drone?: boolean;
  text: string;
}

const ENTRIES: Entry[] = [
  {
    id: 'twinkle', format: 'letters', tags: ['Beginner', 'Kids'], groove: 'ballad',
    blurb: 'The first tune for every new player: steps and small leaps.',
    text: `Title: Twinkle, Twinkle, Little Star
Artist: Traditional
Tempo: 96
Time: 4/4
Octave: 5
C C G G | A A G- | F F E E | D D C- |
G G F F | E E D- | G G F F | E E D- |
C C G G | A A G- | F F E E | D D C- |`,
  },
  {
    id: 'mary', format: 'letters', tags: ['Beginner', 'Kids'], groove: 'pop',
    blurb: 'Three notes for most of the tune. Great for first fingerings.',
    text: `Title: Mary Had a Little Lamb
Artist: Traditional
Tempo: 108
Octave: 5
E D C D | E E E- | D D D- | E G G- |
E D C D | E E E E | D D E D | C--- |`,
  },
  {
    id: 'ode-to-joy', format: 'letters', tags: ['Beginner', 'Classical'], groove: 'ballad',
    blurb: 'Beethoven’s Ninth Symphony theme, all stepwise in D.',
    text: `Title: Ode to Joy
Artist: Beethoven
Tempo: 112
Key: D
Unit: 1/8
Octave: 5
[Theme]
F#- F#- G- A- | A- G- F#- E- | D- D- E- F#- | F#-- E E--- |
F#- F#- G- A- | A- G- F#- E- | D- D- E- F#- | E-- D D--- |
[Middle]
E- E- F#- D- | E- F# G F#- D- | E- F# G F#- E- | D- E- A4--- |
[Theme]
F#- F#- G- A- | A- G- F#- E- | D- D- E- F#- | E-- D D--- |`,
  },
  {
    id: 'frere-jacques', format: 'letters', tags: ['Beginner', 'Kids'], groove: 'march',
    blurb: 'A round: record yourself, then play along with your own take.',
    text: `Title: Frère Jacques
Artist: Traditional
Tempo: 100
Octave: 5
C D E C | C D E C | E F G- | E F G- |
(G A) (G F) E C | (G A) (G F) E C | C G4 C- | C G4 C- |`,
  },
  {
    id: 'jingle-bells', format: 'letters', tags: ['Holiday', 'Beginner'], groove: 'pop',
    blurb: 'The chorus, with its repeated notes for clean tonguing.',
    text: `Title: Jingle Bells
Artist: James Lord Pierpont
Tempo: 120
Octave: 5
E E E- | E E E- | E G C D | E--- |
F F F F | F E E (E E) | E D D E | D- G- |
E E E- | E E E- | E G C D | E--- |
F F F F | F E E (E E) | G G F D | C--- |`,
  },
  {
    id: 'saints', format: 'abc', tags: ['Beginner', 'Jazz'], groove: 'march',
    blurb: 'New Orleans standard with a pickup into each phrase.',
    text: `X:1
T:When the Saints Go Marching In
C:Traditional
M:4/4
L:1/4
Q:1/4=132
K:C
C E F | G4- | G C E F | G4- | G C E F | G2 E2 | C2 E2 | D4- | D E E D | C3 C | E2 G2 | G F3- | F E F G | E2 C2 | D2 D2 | C4 |]`,
  },
  {
    id: 'happy-birthday', format: 'abc', tags: ['Beginner'], groove: 'waltz',
    blurb: 'Starts on a pickup; mind the big leap in the third phrase.',
    text: `X:1
T:Happy Birthday
C:Mildred & Patty Hill
M:3/4
L:1/8
Q:1/4=100
K:C
G>G | A2 G2 c2 | B4 G>G | A2 G2 d2 | c4 G>G | g2 e2 c2 | B2 A2 f>f | e2 c2 d2 | c6 |]`,
  },
  {
    id: 'row-your-boat', format: 'abc', tags: ['Beginner', 'Kids'], groove: 'jig',
    blurb: 'A gentle 6/8 round with a quick run down the scale.',
    text: `X:1
T:Row, Row, Row Your Boat
C:Traditional
M:6/8
L:1/8
Q:3/8=60
K:C
C3 C3 | C2 D E3 | E2 D E2 F | G6 | c c c G G G | E E E C C C | G2 F E2 D | C6 |]`,
  },
  {
    id: 'amazing-grace', format: 'abc', tags: ['Hymn', 'Slow air'], groove: 'slowair',
    blurb: 'Long notes to practise tone, breath and gentle vibrato.',
    text: `X:1
T:Amazing Grace
C:Traditional (John Newton words)
M:3/4
L:1/4
Q:1/4=76
K:G
D | G2 B/G/ | B2 A | G2 E | D2 D | G2 B/G/ | B2 A | d3- | d2 B/d/ | d2 B/G/ | B2 A | G2 E | D2 D | G2 B/G/ | B2 A | G3- | G2 |]`,
  },
  {
    id: 'auld-lang-syne', format: 'abc', tags: ['Folk', 'Holiday'], groove: 'ballad',
    blurb: 'Scottish song in dotted rhythm. The leap to the high E is the test.',
    text: `X:1
T:Auld Lang Syne
C:Traditional (Scotland)
M:4/4
L:1/8
Q:1/4=80
K:G
D2 | G3 G G2 B2 | A3 G A2 B2 | G3 G B2 d2 | e6 e2 | d3 B B2 G2 | A3 G A2 B2 | G3 E E2 D2 | G6 |]`,
  },
  {
    id: 'greensleeves', format: 'abc', tags: ['Folk', 'Renaissance'], groove: 'jig',
    blurb: 'English Renaissance tune in A minor with raised 6ths and 7ths.',
    text: `X:1
T:Greensleeves
C:Traditional (England)
M:6/8
L:1/8
Q:3/8=56
K:Am
A | c2 d e>f e | d2 B G>A B | c2 A A>^G A | B2 ^G E2 A | c2 d e>f e | d2 B G>A B | c>B A ^G>^F ^G | A3 A2 z |
g3 g>f e | d2 B G>A B | c2 A A>^G A | B2 ^G E3 | g3 g>f e | d2 B G>A B | c>B A ^G>^F ^G | A3 A2 |]`,
  },
  {
    id: 'silent-night', format: 'abc', tags: ['Holiday', 'Slow air'], groove: 'waltz',
    blurb: 'Gruber’s carol: smooth slurs over a lilting 3/4.',
    text: `X:1
T:Silent Night
C:Franz Xaver Gruber
M:3/4
L:1/8
Q:1/4=72
K:C
G3 A G2 | E6 | G3 A G2 | E6 | d4 d2 | B6 | c4 c2 | G6 | A4 A2 | c3 B A2 | G3 A G2 | E6 | A4 A2 | c3 B A2 | G3 A G2 | E6 | d4 d2 | f3 d B2 | c6 | e6 | c3 G E2 | G3 F D2 | C6- | C6 |]`,
  },
  {
    id: 'minuet-in-g', format: 'abc', tags: ['Classical'], groove: 'waltz',
    blurb: 'From the Anna Magdalena Bach notebook (Petzold). Eighth-note runs.',
    text: `X:1
T:Minuet in G
C:Christian Petzold
M:3/4
L:1/8
Q:1/4=104
K:G
d2 G A B c | d2 G2 G2 | e2 c d e f | g2 G2 G2 | c2 d c B A | B2 c B A G | F2 G A B G | B4 A2 |
d2 G A B c | d2 G2 G2 | e2 c d e f | g2 G2 G2 | c2 d c B A | B2 c B A G | A2 B A G F | G6 |]`,
  },
  {
    id: 'fur-elise', format: 'abc', tags: ['Classical'], groove: 'none',
    blurb: 'Beethoven’s famous opening. Fast half-step trills between E and D#.',
    text: `X:1
T:Für Elise
C:Beethoven
M:3/8
L:1/16
Q:1/8=120
K:Am
e^d | e^de B=dc | A2 z CEA | B2 z E^GB | c2 z Ee^d | e^de B=dc | A2 z CEA | B2 z EcB | A4 |]`,
  },
  {
    id: 'kesh-jig', format: 'abc', tags: ['Irish', 'Whistle'], groove: 'jig',
    blurb: 'Session favourite. Try cuts and rolls on the long Gs.',
    text: `X:1
T:The Kesh
R:jig
C:Traditional (Ireland)
M:6/8
L:1/8
Q:3/8=96
K:G
|:G3 GAB|A3 ABd|edd gdd|edB dBA|GAG GAB|ABA ABd|edd gdB|AGF G3:|
|:BAB dBd|ege dBG|BAB dBG|A3 ABd|BAB dBd|ege dBd|gfg aga|bgf g3:|`,
  },
  {
    id: 'yaman', format: 'sargam', tags: ['Raga', 'Practice'], groove: 'teentaal', drone: true,
    blurb: 'Raag Yaman: aaroh, avroh and pakad with Tivra Ma. Evening raga.',
    text: `Title: Raag Yaman
Artist: Hindustani raga
Tempo: 72
[Aaroh]
.N Re Ga Ma# | Dha Ni Sa'- |
[Avroh]
Sa' Ni Dha Pa | Ma# Ga Re Sa |
[Pakad]
.N Re Ga Re | Sa- Pa Ma# | Ga Re Sa- |`,
  },
  {
    id: 'bhupali', format: 'sargam', tags: ['Raga', 'Practice'], groove: 'keherwa', drone: true,
    blurb: 'Raag Bhupali: the pentatonic Sa Re Ga Pa Dha. A first raga for bansuri.',
    text: `Title: Raag Bhupali
Artist: Hindustani raga
Tempo: 76
[Aaroh]
Sa Re Ga Pa | Dha Sa'- - |
[Avroh]
Sa' Dha Pa Ga | Re Sa- - |
[Pakad]
Ga Re Sa .Dha | Sa Re Ga- | Pa Ga Dha Pa | Ga Re Sa- |`,
  },
  {
    id: 'alankar', format: 'sargam', tags: ['Practice', 'Beginner'], groove: 'keherwa', drone: true,
    blurb: 'Alankar (palta) in groups of three, up and down the Bilawal scale.',
    text: `Title: Alankar: groups of three
Artist: Exercise
Tempo: 84
Time: 3/4
[Aaroh]
Sa Re Ga | Re Ga Ma | Ga Ma Pa | Ma Pa Dha | Pa Dha Ni | Dha Ni Sa' |
[Avroh]
Sa' Ni Dha | Ni Dha Pa | Dha Pa Ma | Pa Ma Ga | Ma Ga Re | Ga Re Sa |`,
  },
  {
    id: 'long-tones', format: 'letters', tags: ['Practice', 'Beginner'], groove: 'none', drone: true,
    blurb: 'Hold each note of the scale for four beats. Listen for a steady, centred tone.',
    text: `Title: Long tones: major scale
Artist: Exercise
Tempo: 60
Octave: 5
C--- | D--- | E--- | F--- | G--- | A--- | B--- | C6--- |
C6--- | B--- | A--- | G--- | F--- | E--- | D--- | C--- |`,
  },
];

let cache: Song[] | null = null;

export function builtinSongs(): Song[] {
  if (cache) return cache;
  cache = ENTRIES.map((e) => {
    const { song } = parseSongText(e.text, e.format);
    return {
      ...song,
      id: 'builtin-' + e.id,
      builtin: true,
      tags: e.tags,
      blurb: e.blurb,
      groove: e.groove,
      drone: e.drone,
    };
  });
  return cache;
}

export function builtinById(id: string): Song | undefined {
  return builtinSongs().find((s) => s.id === id);
}
