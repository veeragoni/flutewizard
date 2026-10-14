import { pc, SARGAM_SYLLABLE, noteName, useFlatsForKey } from '../../music/theory';
import type { ImportFormat, ParseResult, Song } from '../../music/song';
import { looksLikeAbc, parseAbc } from './abc';
import { parseMidi } from './midi';
import { parseMusicXml } from './musicxml';
import { parseText } from './text';

export { parseAbc, parseMidi, parseMusicXml, parseText };

export type TextFormat = Exclude<ImportFormat, 'midi' | 'musicxml'>;

const SARGAM_TOKEN = /^[.'*]*(sa|re|ri|ga|ma|pa|dha|da|ni|[srgmpdn])(k|\(k\)|#)?[.'*]*-*\/*$/i;
const LETTER_TOKEN = /^[A-Ga-g](#|b)?\d?'*-*\/*$/;

/** Guess which text notation was pasted. */
export function detectTextFormat(text: string): TextFormat {
  if (looksLikeAbc(text)) return 'abc';
  // "Sa: C#4", "Flute: E" or a swara list are only written for sargam.
  if (/^\s*(sa|flute|notes|swaras)\s*[:=]/im.test(text)) return 'sargam';
  const toks = text
    .split('\n')
    .filter((l) => !/^\s*\w+\s*:/.test(l)) // "Title: …" and other details
    .join(' ')
    .split(/[\s|(),~…–—]+/)
    .filter(Boolean);
  let sargam = 0, letters = 0;
  for (const t of toks) {
    const bare = t.replace(/[‘’`´“”"]/g, "'");
    // Two-letter syllables are strong sargam evidence; bare S/R/M/P/N can't be letters at all.
    if (/^[.'*]*(sa|re|ga|ma|pa|dha|ni)/i.test(bare) && SARGAM_TOKEN.test(bare)) sargam += 2;
    else if (/^[.'*]*[SRMPNsrmpn][.'*]*-*$/.test(bare)) sargam += 1;
    // Single letters run together ("MPD", "S'NS'N"): sargam when any of them can't be a letter name.
    else if (/^[.,'*]*([SRGMPDNsrgmpdn][.,'*]*){2,}-*$/.test(bare) && /[SRMPNsrmpn]/.test(bare)) sargam += 2;
    if (LETTER_TOKEN.test(bare)) letters += 1;
  }
  return sargam > letters ? 'sargam' : 'letters';
}

export function parseSongText(text: string, format: TextFormat | 'auto' = 'auto', opts: { sa?: number } = {}): ParseResult {
  const f = format === 'auto' ? detectTextFormat(text) : format;
  if (f === 'abc') return parseAbc(text);
  return parseText(text, f, opts);
}

export async function parseSongFile(file: File): Promise<ParseResult & { text?: string }> {
  const name = file.name.toLowerCase();
  if (/\.(mid|midi)$/.test(name)) return parseMidi(await file.arrayBuffer(), file.name);
  if (/\.mxl$/.test(name)) throw new Error('Compressed .mxl files aren\'t supported yet. In MuseScore, export as "Uncompressed MusicXML (.musicxml)".');
  const text = await file.text();
  if (/\.(musicxml|xml)$/.test(name) || /<score-partwise|<score-timewise/.test(text.slice(0, 2000))) return parseMusicXml(text);
  return { ...parseSongText(text), text };
}

/** Grid (in beats) every note start and length fits on, used to pick the text "unit". */
function gridFor(song: Song): number {
  for (const g of [1, 0.5, 0.25]) {
    if (song.notes.every((n) => isMult(n.start, g) && isMult(n.dur, g))) return g;
  }
  return 0.25;
}
const isMult = (x: number, g: number) => Math.abs(x / g - Math.round(x / g)) < 0.02;

/**
 * Write a song back out as editable text (used for MIDI/MusicXML imports and built-in songs),
 * in letter names or sargam.
 */
export function songToText(song: Song, format: 'letters' | 'sargam'): string {
  const grid = gridFor(song);
  const out: string[] = [];
  out.push(`Title: ${song.title}`);
  if (song.artist) out.push(`Artist: ${song.artist}`);
  out.push(`Tempo: ${song.bpm}`);
  out.push(`Time: ${song.time[0]}/${song.time[1]}`);
  if (format === 'sargam') out.push(`Sa: ${noteName(song.sa ?? 60 + song.tonic)}`);
  else out.push(`Key: ${noteName(song.tonic, { octave: false, flats: useFlatsForKey(song.tonic) })}${song.mode === 'minor' ? 'm' : ''}`);
  if (grid !== 1) out.push(`Unit: 1/${4 / grid}`);
  out.push('');
  const flats = useFlatsForKey(song.mode === 'minor' ? song.tonic + 3 : song.tonic);
  const sa = song.sa ?? 60 + song.tonic;
  const barLen = (song.time[0] * 4) / song.time[1];
  const sections = [...song.sections].sort((a, b) => a.start - b.start);
  let line: string[] = [];
  let bar: string[] = [];
  let barIdx = 0;
  let barsInLine = 0;
  let secIdx = 0;
  const flushBar = () => { if (bar.length) { line.push(bar.join(' ')); bar = []; barsInLine++; } };
  const flushLine = () => { flushBar(); if (line.length) out.push(line.join(' | ') + ' |'); line = []; barsInLine = 0; };
  for (const n of song.notes) {
    while (secIdx < sections.length && sections[secIdx].start <= n.start + 1e-6) {
      flushLine();
      out.push('', `[${sections[secIdx].name}]`);
      secIdx++;
    }
    const b = Math.floor(n.start / barLen + 1e-6);
    while (barIdx < b) {
      flushBar();
      barIdx++;
      if (barsInLine >= 4) flushLine();
    }
    const units = Math.max(1, Math.round(n.dur / grid));
    let tok: string;
    if (n.midi === null) tok = '_';
    else if (format === 'sargam') {
      const rel = n.midi - sa;
      const oct = Math.floor(rel / 12);
      tok = (oct < 0 ? '.'.repeat(-oct) : '') + SARGAM_SYLLABLE[pc(rel)].replace('Ma#', 'Ma#').replace(/^(re|ga|dha|ni)$/, (s) => s[0].toUpperCase() + s.slice(1) + 'k') + (oct > 0 ? "'".repeat(oct) : '');
    } else {
      tok = noteName(n.midi, { flats });
    }
    bar.push(tok + '-'.repeat(units - 1));
  }
  flushLine();
  return out.join('\n') + '\n';
}
