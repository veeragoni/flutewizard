import { LETTER_TO_PC, parseNoteName, SARGAM_SYLLABLE } from '../../music/theory';
import {
  barLength, detectKey, emptySong, type ParseResult, type ParseWarning, type Song, type SongNote,
} from '../../music/song';

/**
 * Plain-text melody notation, one of two pitch spellings:
 *
 *  letters:  C D E F G A B, with # or b, optional octave number (C5) or ' to go up an octave.
 *  sargam:   Sa Re Ga Ma Pa Dha Ni (or S R G M P D N). Komal with a "k" suffix (Rek, Re(k)) or lowercase
 *            single letters (r g d n); if a lowercase m appears, m = shuddha Ma and M = tivra Ma. Lower octave
 *            with a dot or comma (.P, P., ,P), upper octave with ' or * (S' or S*). Single letters can be
 *            run together (MPD, RgR), each then lasting half a beat (RgR, NiSaNi: two grace notes and a
 *            beat on the last). Web sites use ’ both ways (’N lower,
 *            S’ upper); each ambiguous mark is resolved by whichever reading gives the smoother melody.
 *
 * Rhythm (both): each note is one beat. "-", "–" or "…" holds a beat (G-- or G - -), "/" halves (C/ = half beat),
 * ( ) squeezes its notes into one beat, "_" or "z" is a rest, "|" is a bar line.
 * Lines like "Title: …", "Tempo: 96", "Key: D", "Time: 3/4", "Sa: C#4", "Unit: 1/8" set song details.
 * A short first bar before the first "|" is treated as a pickup.
 * [Verse] or "Chorus:" start a section. Lines that are mostly words are kept as lyrics and not played.
 */
export type TextMode = 'letters' | 'sargam';

interface Ctx {
  mode: TextMode;
  sa: number;
  caseSensitiveSargam: boolean;
  /** A lowercase m was written, so uppercase M means tivra Ma. */
  tivraUpperM: boolean;
  /** Syllables are capitalised (Sa Re Ga) but "ma" is written lowercase, so "Ma" and "Ma’" mean tivra Ma. */
  tivraCapitalMa: boolean;
  /** Everything is written in lowercase (s, p too), so capitals mean the upper octave (nSRR). */
  upperIsTaar: boolean;
  /** Dots follow the note they lower (n.d.p.), rather than lead it (.N). */
  dotSuffix: boolean;
  /** Scale given by a "Notes: s r2 g2 m1 p d2 n1" line: semitones above Sa for each letter. */
  scale: Record<string, number> | null;
  baseOctave: number;
  /** Apostrophe marks seen since the last note (sargam), waiting to be attached to the next note. */
  pending: Mark[];
  /** Octave signs that aren't apostrophes: dots and commas (lower), * and ^ (upper). */
  lowerSigns: number;
  upperSigns: number;
}

/** Where an apostrophe sat: at the start of a token, between two run-together notes, or at the end. */
type Mark = 'lead' | 'mid' | 'trail' | 'dot';

const DIRECTIVE = /^\s*\{?\s*(title|t|artist|composer|by|tempo|bpm|key|time|meter|sa|flute|notes|swaras|scale|octave|unit|pickup)\s*[:=]\s*(.+?)\s*\}?\s*$/i;
/** "Flute used for notations : G#", "Bansuri key - A" … */
const FLUTE_LINE = /^\s*(?:flute|bansuri|whistle)\b[^:=\n]{0,40}[:=]\s*([A-Ga-g](?:#|♯|b|♭|\s*sharp|\s*flat)?(?![a-z]{2})\s*.*)$/i;
/** A heading on its own line: "Flute Music:", "Violins Music:". */
const HEADING = /^\s*([A-Za-z][A-Za-z0-9 '&/-]{0,40}?)\s*:\s*$/;
/** Parts for other instruments, which aren't the flute melody. */
const OTHER_PART = /\b(violins?|strings?|piano|keyboards?|guitars?|chords?|harmonium|tabla|drums?|backing|accompaniment|cello|sitar|santoor)\b/i;
/** Where a second version of the same tune starts. */
export const ALT_VERSION = /^\s*(?:[=*_~#-]{4,}|(?:option|version|alternative|alternate|variation)\s*\d*\s*:?)\s*$/i;
/** A video timestamp at the start of a line ("02:52|", "[1:05:10]"), as on notations made from tutorials. */
export const TIMESTAMP = /^\s*[\[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?\s*(?:[|:>)\]-]+|[–—.](?=\s))?\s*/;
const SECTION_BRACKET = /^\s*\[([^\]]{1,40})\]\s*$/;
const SECTION_WORD = /^\s*(intro|verse|pre-?chorus|chorus|bridge|outro|interlude|refrain|solo|music|instrumental|bgm|prelude|ending|sthayi|sthai|antara|mukhda|pallavi|anupallavi|charanam|coda|part\s*[a-z0-9]+)\b\s*\d*\s*:?\s*$/i;

export function parseText(text: string, mode: TextMode, opts: { sa?: number } = {}): ParseResult {
  const song = emptySong();
  song.source = { format: mode, text };
  const warnings: ParseWarning[] = [];
  const skippedLines: number[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  const lower = mode === 'sargam' ? lowercaseSargam(lines) : { komal: false, m: false, plain: false, upper: false, dotSuffix: false };
  const ctx: Ctx = {
    mode,
    sa: opts.sa ?? 60,
    caseSensitiveSargam: !lower.plain && (lower.komal || lower.m),
    tivraUpperM: !lower.plain && lower.m,
    tivraCapitalMa: mode === 'sargam' && syllableCase(lines),
    upperIsTaar: lower.plain && lower.upper,
    dotSuffix: lower.dotSuffix,
    scale: null,
    baseOctave: 4,
    pending: [],
    lowerSigns: 0,
    upperSigns: 0,
  };
  const marked: { note: SongNote; marks: Mark[] }[] = [];
  let keyGiven: { tonic: number; mode: 'major' | 'minor' } | null = null;
  let unit = 1;
  let t = 0;
  let prevWasNotes = false;
  let firstBarAt: number | null = null;
  let pickup: number | null = null;
  const notes: SongNote[] = [];
  const lyrics: { start: number; text: string }[] = [];
  let lastNoteStart = 0;

  let stoppedAt: { line: number; text: string } | null = null;
  let skippingPart: { name: string; from: number; to: number } | null = null;
  const skippedParts: { name: string; from: number; to: number }[] = [];

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    let line = raw.replace(/\t/g, ' ');
    if (stoppedAt) return;
    const stamp = TIMESTAMP.exec(line);
    if (stamp && !DIRECTIVE.test(line)) {
      // Where this line is played in the video: kept as a section so it's easy to find.
      line = line.slice(stamp[0].length);
      if (!skippingPart) song.sections.push({ name: stamp[1], start: t });
    }
    if (!line.trim()) {
      prevWasNotes = false;
      return;
    }

    if (ALT_VERSION.test(line)) {
      // A second version of the tune follows: play only the first (if there is one yet).
      if (notes.some((n) => n.midi !== null)) stoppedAt = { line: lineNo, text: line.trim() };
      return;
    }
    const heading = !DIRECTIVE.test(line) && !FLUTE_LINE.test(line) ? HEADING.exec(line) : null;
    if (heading || SECTION_BRACKET.test(line) || SECTION_WORD.test(line)) {
      if (skippingPart) { skippedParts.push(skippingPart); skippingPart = null; }
      const name = (heading?.[1] ?? '').trim();
      if (heading && OTHER_PART.test(name) && !/flute|bansuri|whistle|melody/i.test(name)) {
        skippingPart = { name, from: lineNo, to: lineNo };
        return;
      }
      if (heading) {
        song.sections.push({ name, start: t });
        return;
      }
    }
    if (skippingPart) {
      skippingPart.to = lineNo;
      return;
    }
    const fl = !DIRECTIVE.test(line) ? FLUTE_LINE.exec(line) : null;
    if (fl) {
      const p = fluteSa(fl[1]);
      if (p === null) warnings.push({ line: lineNo, message: `Flute "${fl[1]}" should name its key, like "G#" or "E bass".` });
      else if (opts.sa === undefined) ctx.sa = p;
      return;
    }

    const dir = DIRECTIVE.exec(line);
    if (dir) {
      const key = dir[1].toLowerCase();
      const val = dir[2];
      switch (key) {
        case 'title': case 't': song.title = val; break;
        case 'artist': case 'composer': case 'by': song.artist = val; break;
        case 'tempo': case 'bpm': {
          const n = parseFloat(val);
          if (n >= 10 && n <= 400) song.bpm = n;
          else warnings.push({ line: lineNo, message: `Tempo "${val}" is not a number of beats per minute.` });
          break;
        }
        case 'key': {
          const m = /^([A-G][#b]?)\s*(m|min|minor)?/i.exec(val.trim());
          const p = m ? parseNoteName(m[1][0].toUpperCase() + m[1].slice(1), 4) : null;
          if (p === null || !m) warnings.push({ line: lineNo, message: `Key "${val}" not understood; detecting it from the notes.` });
          else keyGiven = { tonic: p % 12, mode: m[2] ? 'minor' : 'major' };
          break;
        }
        case 'time': case 'meter': {
          const m = /^(\d+)\s*\/\s*(\d+)$/.exec(val.trim());
          if (m) song.time = [parseInt(m[1], 10), parseInt(m[2], 10)];
          else warnings.push({ line: lineNo, message: `Time "${val}" should look like 3/4.` });
          break;
        }
        case 'sa': {
          const p = parseNoteName(val, 4);
          if (p === null) warnings.push({ line: lineNo, message: `Sa "${val}" should be a note like C#4.` });
          else ctx.sa = p;
          break;
        }
        case 'octave': {
          const n = parseInt(val, 10);
          if (n >= 1 && n <= 8) ctx.baseOctave = n;
          break;
        }
        case 'flute': {
          const p = fluteSa(val);
          if (p === null) warnings.push({ line: lineNo, message: `Flute "${val}" should name its key, like "E" or "F# middle".` });
          else if (opts.sa === undefined) ctx.sa = p;
          break;
        }
        case 'notes': case 'swaras': case 'scale': {
          const sc = parseSwaraSet(val);
          if (sc) {
            ctx.scale = sc.scale;
            warnings.push({ line: lineNo, message: `Scale read as ${sc.label}.`, info: true });
          } else if (mode === 'sargam') {
            warnings.push({ line: lineNo, message: `Notes "${val}" not understood; write them like "s r2 g2 m1 p d2 n2".` });
          }
          break;
        }
        case 'pickup': {
          const n = parseFloat(val);
          if (n >= 0) pickup = n;
          break;
        }
        case 'unit': {
          const m = /^(\d+)\s*\/\s*(\d+)$/.exec(val.trim());
          if (m) unit = (parseInt(m[1], 10) * 4) / parseInt(m[2], 10);
          break;
        }
      }
      return;
    }

    const sec = SECTION_BRACKET.exec(line) ?? SECTION_WORD.exec(line);
    if (sec) {
      song.sections.push({ name: sec[1].trim().replace(/:$/, ''), start: t });
      return;
    }

    const parsed = parseLine(line, ctx, unit);
    if (!parsed) {
      // A note to the reader in brackets, or a line of symbols: not lyrics.
      if (/^\s*[({].*[)}]\s*$/.test(line) || !/[A-Za-z\u0900-\u097F]{2}/.test(line)) return;
      skippedLines.push(lineNo);
      // Words right under a line of notes belong to it; otherwise they introduce the next line.
      lyrics.push({ start: prevWasNotes ? lastNoteStart : t, text: line.trim() });
      prevWasNotes = false;
      return;
    }
    prevWasNotes = true;
    lastNoteStart = t;
    for (const ev of parsed.events) {
      if (ev.kind === 'bar') {
        if (firstBarAt === null) firstBarAt = t;
        continue;
      }
      if (ev.kind === 'hold') {
        const prev = notes[notes.length - 1];
        if (prev && Math.abs(prev.start + prev.dur - t) < 1e-6) prev.dur += ev.dur;
        else notes.push({ midi: null, start: t, dur: ev.dur });
        t += ev.dur;
      } else {
        const note: SongNote = { midi: ev.midi, start: t, dur: ev.dur };
        notes.push(note);
        if (ev.midi !== null) marked.push({ note, marks: ev.marks ?? [] });
        t += ev.dur;
      }
    }
    for (const bad of parsed.unknown) {
      warnings.push({ line: lineNo, message: `"${bad}" isn't a ${mode === 'sargam' ? 'sargam note' : 'note'}; skipped.` });
    }
  });

  if (skippingPart) skippedParts.push(skippingPart);
  for (const sp of skippedParts) {
    warnings.push({ line: sp.from, message: `Skipped the "${sp.name}" part (lines ${sp.from}–${sp.to}): only the flute melody plays.` });
  }
  if (stoppedAt) {
    const s0 = stoppedAt as { line: number; text: string };
    warnings.unshift({ line: s0.line, message: `A second version starts at line ${s0.line}; only the first one plays. To use the other, delete the first.` });
  }
  if (mode === 'sargam') resolveOctaves(marked, ctx);
  song.notes = mergeRests(notes);
  song.lyrics = lyrics.length ? lyrics : undefined;
  alignPickup(song, pickup ?? firstBarAt);
  if (mode === 'sargam') song.sa = ctx.sa;
  const key = keyGiven ?? (mode === 'sargam' ? { tonic: ctx.sa % 12, mode: 'major' as const } : detectKey(song));
  song.tonic = key.tonic;
  song.mode = key.mode;
  if (song.sa === undefined) song.sa = 60 + song.tonic;
  if (!song.notes.some((n) => n.midi !== null)) {
    warnings.push({ line: 0, message: 'No notes found yet. Write notes like "C D E F G" or "Sa Re Ga Ma".' });
  }
  if (skippedLines.length) {
    warnings.unshift({
      line: skippedLines[0],
      message: `${skippedLines.length} line${skippedLines.length > 1 ? 's' : ''} of words ${skippedLines.length > 1 ? 'were' : 'was'} kept as lyrics. Only notes play.`,
    });
  }
  return { song: song as Song, warnings, skippedLines };
}

/**
 * If the music starts with a partial bar (a pickup, like the "Hap-py" of Happy Birthday),
 * shift everything so bar lines fall where the writer put them.
 */
export function alignPickup(song: Song, firstBarAt: number | null) {
  const len = barLength(song.time);
  if (firstBarAt === null || firstBarAt <= 1e-6 || firstBarAt >= len - 1e-6) return;
  const shift = len - firstBarAt;
  for (const n of song.notes) n.start += shift;
  for (const sct of song.sections) if (sct.start > 0) sct.start += shift;
  for (const l of song.lyrics ?? []) l.start += shift;
}

function mergeRests(notes: SongNote[]): SongNote[] {
  const out: SongNote[] = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (n.midi === null && prev && prev.midi === null) prev.dur += n.dur;
    else out.push({ ...n });
  }
  while (out.length && out[out.length - 1].midi === null) out.pop();
  return out;
}

type Ev =
  | { kind: 'note'; midi: number | null; dur: number; marks?: Mark[] }
  | { kind: 'hold'; dur: number }
  | { kind: 'bar'; dur: number };

/** Returns null when the line looks like words rather than notes. */
function parseLine(line0: string, ctx: Ctx, unit: number): { events: Ev[]; unknown: string[] } | null {
  // "(x2)", "(2)" or "x3" at the end of a line plays it that many times.
  const rep = /(?:\(\s*[x×]?\s*(\d{1,2})\s*(?:times)?\s*\)|(?:^|\s)[x×](\d{1,2}))\s*$/i.exec(line0);
  const times = rep ? Math.max(1, Math.min(16, parseInt(rep[1] ?? rep[2], 10))) : 1;
  const line = rep ? line0.slice(0, rep.index) : line0;
  let spaced = line
    // Komal/tivra markers written in brackets aren't rhythm groups.
    .replace(/\((k|komal)\)/gi, 'k')
    .replace(/\((t|tivra)\)/gi, '#')
    .replace(/[()]/g, (c) => ` ${c} `)
    .replace(/\|+:?|:?\|+/g, ' | ')
    // Dashes and ellipses hold the note before them.
    .replace(/[–—]/g, ' - ')
    .replace(/…+\.*/g, ' - ');
  if (ctx.mode === 'sargam') {
    spaced = spaced
      // A run of dots holds the note, about half a beat per dot. Where single dots mark the lower octave
      // (n.), the first dot might be one too ("p.."); the melody decides (¤).
      .replace(/(\S?)(\.{2,})/g, (_, before: string, dots: string) =>
        `${before}${ctx.dotSuffix && /[a-zA-Z]/.test(before) ? '¤' : ''} ${'-'.repeat(Math.max(1, Math.round(dots.length / 2)))} `)
      // "Dh^^Pa": carets in a row hold the note, like dots.
      .replace(/\^{2,}/g, (c) => ` ${'-'.repeat(Math.max(1, Math.round(c.length / 2)))} `)
      .replace(/[‘’`´“”"']/g, '’')
      .replace(/~/g, '') // a glide (meend) between two notes
      // A comma right before a single-letter note marks the lower octave (,D); otherwise it separates.
      .replace(/,(?![SRGMPDNsrgmpdn](?!h|[aeiAEI]))/g, ' ');
  } else {
    spaced = spaced.replace(/,/g, ' ');
  }
  const rawTokens = spaced.split(/\s+/).filter(Boolean);
  const events: Ev[] = [];
  const unknown: string[] = [];
  const pendingBefore = ctx.pending;
  let good = 0, bad = 0;

  let group: Ev[] | null = null;
  const push = (ev: Ev) => (group ? group.push(ev) : events.push(ev));

  for (const tok0 of rawTokens) {
    if (tok0 === '|') {
      if (!group) events.push({ kind: 'bar', dur: 0 });
      continue;
    }
    if (tok0 === '(') { group = []; continue; }
    if (tok0 === ')') {
      if (group) {
        const g: Ev[] = group;
        group = null;
        const total = g.reduce((a, e) => a + e.dur, 0) || 1;
        for (const e of g) events.push({ ...e, dur: (e.dur / total) * unit });
      }
      continue;
    }
    for (const tok of splitJoined(tok0)) {
      const evs = ctx.mode === 'sargam' ? scanSargam(tok, ctx, unit) : parseToken(tok, ctx, unit);
      if (evs) {
        for (const ev of Array.isArray(evs) ? evs : [evs]) {
          push(ev);
          if (ev.kind === 'note' && ev.midi !== null) good++;
        }
      } else {
        bad++;
        unknown.push(tok);
      }
    }
  }
  if (good === 0 || bad >= good) {
    ctx.pending = pendingBefore;
    return null;
  }
  if (times > 1) {
    const once = events.slice();
    for (let k = 1; k < times; k++) for (const e of once) events.push(e.kind === 'note' ? { ...e, marks: [] } : { ...e });
  }
  return { events, unknown };
}

/** "C-D-E" → ["C", "D", "E"], but "G--" stays as one held note. */
function splitJoined(tok: string): string[] {
  if (!/-[^-\s]/.test(tok)) return [tok];
  const parts = tok.split(/-(?=[^-])/);
  return parts.length > 1 && parts.every((p) => p.length > 0) ? parts : [tok];
}

function parseToken(tok: string, ctx: Ctx, unit: number): Ev | null {
  if (/^-+$/.test(tok)) return { kind: 'hold', dur: tok.length * unit };
  // Duration suffix: trailing dashes add beats, trailing slashes halve.
  const m = /^(.*?)(-*)(\/*)$/.exec(tok)!;
  const body = m[1];
  let dur = unit * (1 + m[2].length) / Math.pow(2, m[3].length);
  if (!body) return null;
  if (/^(_+|z|rest|x)$/i.test(body)) return { kind: 'note', midi: null, dur };
  const midi = parseLetter(body, ctx);
  if (midi === null) return null;
  if (dur <= 0) dur = unit;
  return { kind: 'note', midi, dur };
}

function parseLetter(s: string, ctx: Ctx): number | null {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2}|♯|♭)?(-?\d)?('*)$/.exec(s);
  if (!m) return null;
  let p = LETTER_TO_PC[m[1].toUpperCase()];
  if (m[2]) p += m[2][0] === '#' || m[2] === '♯' ? m[2].length : -m[2].length;
  const oct = m[3] !== undefined ? parseInt(m[3], 10) : ctx.baseOctave;
  let midi = (oct + 1) * 12 + p;
  midi += 12 * m[4].length;
  return midi;
}

const SINGLE: Record<string, number> = { S: 0, R: 2, G: 4, M: 5, P: 7, D: 9, N: 11 };
const NOTE_AT = /^(dha|sa|re|ri|ga|ma|pa|da|dh|ni|[srgmpdn])(\(k\)|\(t\)|_k|k(?![a-z])|#)?/i;
const SYLLABLE_PC: Record<string, number> = { sa: 0, re: 2, ri: 2, ga: 4, ma: 5, pa: 7, dha: 9, da: 9, dh: 9, ni: 11 };

/**
 * Reads one sargam token, which may hold several notes run together ("MPD", "RgR", "S’NS’N", ",D,NSRgM").
 * Apostrophes are left as marks for resolveOctaves(); everything else becomes a pitch here.
 */
function scanSargam(tok0: string, ctx: Ctx, unit: number): Ev[] | null {
  if (/^-+$/.test(tok0)) return [{ kind: 'hold', dur: tok0.length * unit }];
  const tail = /(-*)(\/*)$/.exec(tok0)!;
  const tok = tok0.slice(0, tok0.length - tail[0].length).normalize('NFD');
  if (!tok) return null;
  if (/^(_+|z|rest|x)$/i.test(tok)) return [{ kind: 'note', midi: null, dur: unit * (1 + tail[1].length) / Math.pow(2, tail[2].length) }];

  type Item = { kind: 'note'; midi: number } | { kind: 'mark'; mark: Mark };
  const items: Item[] = [];
  let prefix = 0;
  let i = 0;
  const lastNote = () => [...items].reverse().find((x) => x.kind === 'note') as { midi: number } | undefined;
  while (i < tok.length) {
    const c = tok[i];
    const rest = tok.slice(i + 1);
    const noteAhead = NOTE_AT.test(rest.replace(/^[.,’*^]+/, ''));
    if (c === '’') {
      items.push({ kind: 'mark', mark: !lastNote() ? 'lead' : noteAhead ? 'mid' : 'trail' });
    } else if (c === '¤') {
      if (lastNote()) items.push({ kind: 'mark', mark: 'dot' });
    } else if (c === ',' || (c === '.' && (!lastNote() || (noteAhead && !ctx.dotSuffix)))) {
      // Lower octave for the next note (,D or .P) …
      prefix -= 1;
      ctx.lowerSigns++;
    } else if (c === '.') {
      // … or for the note just written (P. or n.d.).
      lastNote()!.midi -= 12;
      ctx.lowerSigns++;
    } else if (c === '*' || c === '^') {
      ctx.upperSigns++;
      if (lastNote() && !noteAhead) lastNote()!.midi += 12;
      else prefix += 1;
    } else if (c === '̣' || c === '̇') {
      const n = lastNote();
      if (!n) return null;
      n.midi += c === '̣' ? -12 : 12;
      if (c === '̣') ctx.lowerSigns++;
      else ctx.upperSigns++;
    } else {
      const m = NOTE_AT.exec(tok.slice(i));
      if (!m) return null;
      const pc = notePc(m[1], ctx);
      if (pc === null) return null;
      let acc = 0;
      if (m[2]) acc = /t|#/i.test(m[2]) ? 1 : -1;
      else if (ctx.tivraCapitalMa && m[1] === 'Ma') {
        acc = 1;
        if (tok[i + 2] === '’') i++; // "Ma’" is this writer's tivra sign, not an octave mark
      }
      items.push({ kind: 'note', midi: ctx.sa + pc + acc + prefix * 12 });
      prefix = 0;
      i += m[0].length;
      continue;
    }
    i++;
  }
  const count = items.filter((x) => x.kind === 'note').length;
  if (!count) return null;
  // One note fills the beat; notes run together are half a beat each. Dashes/slashes apply to the last.
  // Three run together that come back to the first ("NiSaNi", "PaDhPa") are an ornament: two quick
  // grace notes landing on the last.
  const ns = items.filter((x) => x.kind === 'note') as { midi: number }[];
  const ornament = count === 3 && ns[0].midi === ns[2].midi && ns[1].midi !== ns[0].midi;
  const each = count === 1 ? unit : unit / 2;
  const evs: Ev[] = [];
  let seen = 0;
  for (const it of items) {
    if (it.kind === 'mark') { ctx.pending.push(it.mark); continue; }
    seen++;
    let dur = ornament ? (seen === 3 ? unit : unit / 4) : each;
    if (seen === count) dur = (dur + tail[1].length * unit) / Math.pow(2, tail[2].length);
    evs.push({ kind: 'note', midi: it.midi, dur, marks: ctx.pending });
    ctx.pending = [];
  }
  return evs;
}

function notePc(name: string, ctx: Ctx): number | null {
  const syl = SYLLABLE_PC[name.toLowerCase()];
  if (name.length > 1) return syl ?? null;
  const upper = name.toUpperCase();
  if (SINGLE[upper] === undefined) return null;
  const base = ctx.scale ? ctx.scale[upper] : SINGLE[upper];
  if (ctx.upperIsTaar) return base + (name === upper ? 12 : 0);
  if (ctx.scale) return base;
  if (ctx.caseSensitiveSargam && 'rgdn'.includes(name)) return base - 1;
  if (ctx.tivraUpperM && name === 'M') return base + 1;
  return base;
}

/**
 * How the writer spells single-letter sargam: lowercase komal notes (S r G m P), or everything in
 * lowercase (s r g p, with capitals for the upper octave), and whether dots come after notes (n.d.).
 */
function lowercaseSargam(lines: string[]) {
  const out = { komal: false, m: false, plain: false, upper: false, dotSuffix: false };
  let dotAfter = 0, dotBefore = 0;
  for (const line of lines) {
    if (DIRECTIVE.test(line)) continue;
    for (const tok of line.split(/[\s|()~,…\-–—]+/)) {
      const bare = tok.replace(/[.’‘'`*^_/]/g, '');
      // Only tokens made purely of single-letter notes (so words and "Sa", "ma" don't count).
      if (!/^[SRGMPDNsrgmpdn]+$/.test(bare)) continue;
      if (/[rgdn]/.test(bare)) out.komal = true;
      if (/m/.test(bare)) out.m = true;
      if (/[sp]/.test(bare)) out.plain = true; // s and p have no komal form, so lowercase is just style
      if (/[SRGMPDN]/.test(bare)) out.upper = true;
      dotAfter += (tok.match(/[A-Za-z]\.(?!\.)/g) ?? []).length;
      dotBefore += (tok.match(/(^|[^A-Za-z.])\.[A-Za-z]/g) ?? []).length;
    }
  }
  out.dotSuffix = dotAfter > dotBefore;
  return out;
}

/**
 * Writers who capitalise syllables (Sa Re Ga Pa) but write "ma" in lowercase use the case to tell
 * shuddha ma from tivra Ma ("maGamaRe … GaMa’PaMa’Pa").
 */
function syllableCase(lines: string[]): boolean {
  let lowerMa = 0, capital = 0, lowercase = 0;
  for (const line of lines) {
    if (DIRECTIVE.test(line)) continue;
    for (const tok of line.replace(TIMESTAMP, '').split(/[\s|()~,…\-–—.^’‘'`*]+/)) {
      // Only tokens made purely of syllables, so words don't count.
      if (!/^(?:dha|dh|sa|re|ri|ga|ma|pa|da|ni)+$/i.test(tok)) continue;
      for (const [syl] of tok.matchAll(/dha|dh|sa|re|ri|ga|ma|pa|da|ni/gi)) {
        if (syl === 'ma') lowerMa++;
        else if (/^ma$/i.test(syl)) continue;
        else if (syl[0] === syl[0].toUpperCase()) capital++;
        else lowercase++;
      }
    }
  }
  return lowerMa > 0 && capital >= 4 && capital >= 3 * lowercase;
}

/**
 * "F# middle", "G#", "E bass", "C high", "C#5" → MIDI of Sa. Bansuris are named by Sa: a plain
 * key means the usual size (Sa in octave 4, C in octave 5); "bass" is an octave lower for G–B,
 * "high"/"small" an octave higher. Kept within the sizes the app offers (G3–C5).
 */
export function fluteSa(val: string): number | null {
  const m = /^\s*([A-Ga-g])\s*(#|♯|b(?![a-z])|♭|sharp|flat)?\s*(\d)?\s*(.*)$/i.exec(val);
  if (!m) return null;
  const acc = !m[2] ? 0 : /#|♯|sharp/i.test(m[2]) ? 1 : -1;
  const pc = (LETTER_TO_PC[m[1].toUpperCase()] + acc + 12) % 12;
  if (m[3]) return (parseInt(m[3], 10) + 1) * 12 + pc;
  const words = m[4].toLowerCase();
  let midi = (pc === 0 ? 72 : 60) + pc; // C natural is usually the small C (C5)
  if (/bass|base|low/.test(words) && midi - 12 >= 55) midi -= 12;
  else if (/high|small|soprano/.test(words) && midi + 12 <= 72) midi += 12;
  while (midi > 72) midi -= 12;
  while (midi < 55) midi += 12;
  return midi;
}

const CARNATIC: Record<string, number[]> = { R: [1, 2, 3], G: [2, 3, 4], M: [5, 6], D: [8, 9, 10], N: [9, 10, 11] };
const HINDUSTANI: Record<string, number[]> = { R: [1, 2], G: [3, 4], M: [5, 6], D: [8, 9], N: [10, 11] };

/**
 * A scale line like "s r2 g2 m1 p d2 n2" (Carnatic swara numbers). Some writers number each note
 * 1 = komal, 2 = shuddha instead; that reading is used when the Carnatic one isn't a valid scale.
 */
export function parseSwaraSet(val: string): { scale: Record<string, number>; label: string } | null {
  const toks = val.trim().split(/[\s,]+/).filter(Boolean);
  const nums: Record<string, number> = {};
  for (const t of toks) {
    const m = /^([srgmpdn])a?([123])?$/i.exec(t);
    if (!m) return null;
    nums[m[1].toUpperCase()] = m[2] ? parseInt(m[2], 10) : 0;
  }
  if (Object.keys(nums).length < 3) return null;
  const build = (table: Record<string, number[]>) => {
    const sc: Record<string, number> = { ...SINGLE };
    for (const [k, n] of Object.entries(nums)) {
      if (!table[k] || !n) continue;
      const v = table[k][n - 1];
      if (v === undefined) return null;
      sc[k] = v;
    }
    const used = ['S', 'R', 'G', 'M', 'P', 'D', 'N'].filter((k) => k in nums).map((k) => sc[k]);
    return used.every((v, i) => i === 0 || v > used[i - 1]) ? sc : null;
  };
  const sc = build(CARNATIC) ?? build(HINDUSTANI);
  if (!sc) return null;
  const names = ['S', 'R', 'G', 'M', 'P', 'D', 'N'].filter((k) => k in nums)
    .map((k) => SARGAM_SYLLABLE[sc[k]].replace('#', ' tivra').replace(/^(re|ga|dha|ni)$/, 'komal $1'));
  return { scale: sc, label: names.join(' ') };
}

/**
 * Decides which octave each note is in. "S’" (at the end) is the upper octave; "’N" (at the start) is
 * usually the lower octave; between two notes ("S’N") it could be either. Picks the readings that give
 * the smoothest melody overall, since tunes mostly move by small steps.
 *
 * Writers who mark no octaves at all ("Dh NiSaNi", "maGaReSaNi") leave every note's octave to the
 * reader: those notes may move up or down an octave when that makes the melody much smoother.
 */
function resolveOctaves(seq: { note: SongNote; marks: Mark[] }[], ctx: Ctx) {
  const n = seq.length;
  const trailing = ctx.pending;
  const all = [...seq.flatMap((s) => s.marks), ...trailing];
  if (!n) return;
  const usesLead = all.includes('lead'), usesTrail = all.includes('trail');
  // Unmarked notes: fixed when the writer marks lower notes; may only go down when they mark upper ones.
  const upperMarks = ctx.upperSigns + all.filter((m) => m === 'trail' || m === 'mid').length;
  const marksLower = ctx.lowerSigns > 0 || usesLead || all.includes('dot') || ctx.upperIsTaar;
  const FREE = 3; // cost of moving an unmarked note out of the middle octave
  const free = marksLower ? [0] : upperMarks >= 3 ? [0, -12] : [0, -12, 12];
  if (!all.length && free.length === 1) return;

  type Combo = { prev: number; next: number; cost: number };
  // The writer's habit decides first: never "’N" → every mark is "S’" (upper); never "S’" → every mark is
  // "’N" (lower). Only texts that use both need the melody to decide.
  const up = { prev: 12, next: 0, cost: 0 }, down = { prev: 0, next: -12, cost: 0 };
  const OPTIONS: Record<Mark, Combo[]> = {
    trail: [up],
    lead: [down, { prev: 0, next: 12, cost: 1 }],
    dot: [{ prev: 0, next: 0, cost: 0 }, { prev: -12, next: 0, cost: 0.3 }],
    mid: !usesLead ? [up] : !usesTrail ? [down] : [up, { ...down, cost: 0.5 }],
  };
  // gaps[i] = marks before note i; gaps[n] = marks after the last note.
  const gaps = [...seq.map((s) => s.marks), trailing].map((marks) => {
    let combos: Combo[] = [{ prev: 0, next: 0, cost: 0 }];
    for (const mk of marks.slice(0, 4)) {
      combos = combos.flatMap((c) => OPTIONS[mk].map((o) => ({ prev: c.prev + o.prev, next: c.next + o.next, cost: c.cost + o.cost })));
    }
    return combos;
  });
  const shifts = seq.map((s, i) => (s.marks.length || (i + 1 < n ? seq[i + 1].marks : trailing).length ? [0] : free));
  const base = seq.map((s) => s.note.midi!);
  const pitch = (i: number, a: number, b: number, k: number) => base[i] + gaps[i][a].next + gaps[i + 1][b].prev + shifts[i][k];
  const own = (i: number, b: number, k: number) => gaps[i + 1][b].cost + (shifts[i][k] ? FREE : 0);
  const leap = (x: number, y: number) => {
    const d = Math.abs(x - y);
    return d + 2 * Math.max(0, d - 7) + 4 * Math.max(0, d - 12);
  };
  // DP over notes; state = (choice for the gap before note i, the gap after it, its own shift).
  let dp = new Map<string, number>();
  const back: Map<string, string>[] = [];
  for (let a = 0; a < gaps[0].length; a++) {
    for (let b = 0; b < gaps[1].length; b++) {
      for (let k = 0; k < shifts[0].length; k++) dp.set(`${a},${b},${k}`, gaps[0][a].cost + own(0, b, k));
    }
  }
  for (let i = 1; i < n; i++) {
    const next = new Map<string, number>();
    const from = new Map<string, string>();
    for (const [key, cost0] of dp) {
      const [a, b, k0] = key.split(',').map(Number);
      const p0 = pitch(i - 1, a, b, k0);
      for (let c = 0; c < gaps[i + 1].length; c++) {
        for (let k = 0; k < shifts[i].length; k++) {
          const cost = cost0 + own(i, c, k) + leap(p0, pitch(i, b, c, k));
          const nk = `${b},${c},${k}`;
          if (!next.has(nk) || cost < next.get(nk)!) { next.set(nk, cost); from.set(nk, key); }
        }
      }
    }
    back.push(from);
    dp = next;
  }
  let bestKey = '';
  for (const [k, v] of dp) if (!bestKey || v < dp.get(bestKey)!) bestKey = k;
  let key = bestKey;
  for (let i = n - 1; i >= 0; i--) {
    const [a, b, k] = key.split(',').map(Number);
    seq[i].note.midi = pitch(i, a, b, k);
    if (i > 0) key = back[i - 1].get(key)!;
  }
}
