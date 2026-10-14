import { detectKey, emptySong, type ParseResult, type ParseWarning, type SongNote } from '../../music/song';

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Uncompressed MusicXML (.musicxml / .xml). Reads the first part, voice 1, top note of chords. */
export function parseMusicXml(text: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('This MusicXML file could not be read.');
  const song = emptySong();
  song.source = { format: 'musicxml', text: '' };
  const title = doc.querySelector('work-title')?.textContent ?? doc.querySelector('movement-title')?.textContent;
  if (title) song.title = title.trim();
  const composer = doc.querySelector('creator[type="composer"]')?.textContent;
  if (composer) song.artist = composer.trim();

  const parts = doc.querySelectorAll('part');
  if (!parts.length) throw new Error('No music found in this MusicXML file.');
  if (parts.length > 1) warnings.push({ line: 0, message: `Used the first of ${parts.length} parts.` });
  const part = parts[0];

  let divisions = 1;
  let t = 0; // quarter beats
  let tempo: number | null = null;
  const notes: (SongNote & { tie?: boolean })[] = [];
  const lyrics: { start: number; text: string }[] = [];
  let lyricLine = '';
  let lyricStart = 0;

  for (const measure of Array.from(part.querySelectorAll(':scope > measure'))) {
    let cursor = t;
    for (const el of Array.from(measure.children)) {
      switch (el.tagName) {
        case 'attributes': {
          const d = el.querySelector('divisions');
          if (d) divisions = parseFloat(d.textContent || '1') || 1;
          const beats = el.querySelector('time > beats');
          const bt = el.querySelector('time > beat-type');
          if (beats && bt) song.time = [parseInt(beats.textContent!, 10), parseInt(bt.textContent!, 10)];
          break;
        }
        case 'direction': case 'sound': {
          const s = el.tagName === 'sound' ? el : el.querySelector('sound');
          const tp = s?.getAttribute('tempo');
          if (tp && tempo === null) tempo = parseFloat(tp);
          break;
        }
        case 'backup': cursor -= num(el, 'duration') / divisions; break;
        case 'forward': cursor += num(el, 'duration') / divisions; break;
        case 'note': {
          const voice = el.querySelector('voice')?.textContent ?? '1';
          const isChord = !!el.querySelector('chord');
          const isGrace = !!el.querySelector('grace');
          const dur = num(el, 'duration') / divisions;
          if (isGrace) break;
          if (voice !== '1') { if (!isChord) cursor += dur; break; }
          const pitch = el.querySelector('pitch');
          let midi: number | null = null;
          if (pitch) {
            const step = pitch.querySelector('step')!.textContent!.trim();
            const alter = parseFloat(pitch.querySelector('alter')?.textContent || '0');
            const octave = parseInt(pitch.querySelector('octave')!.textContent!, 10);
            midi = (octave + 1) * 12 + STEP[step] + Math.round(alter);
          }
          const tieStop = !!el.querySelector('tie[type="stop"]');
          const tieStart = !!el.querySelector('tie[type="start"]');
          if (isChord) {
            const prev = notes[notes.length - 1];
            if (prev && midi !== null && (prev.midi === null || midi > prev.midi)) prev.midi = midi;
            break;
          }
          const prev = notes[notes.length - 1];
          if (tieStop && prev && prev.midi === midi && prev.tie) {
            prev.dur += dur;
            prev.tie = tieStart;
          } else {
            notes.push({ midi, start: cursor, dur, tie: tieStart });
          }
          const lyr = el.querySelector('lyric > text')?.textContent;
          if (lyr) {
            if (!lyricLine) lyricStart = cursor;
            const syl = el.querySelector('lyric > syllabic')?.textContent;
            lyricLine += lyr + (syl === 'begin' || syl === 'middle' ? '' : ' ');
            if (lyricLine.length > 60) { lyrics.push({ start: lyricStart, text: lyricLine.trim() }); lyricLine = ''; }
          }
          cursor += dur;
          break;
        }
      }
      t = Math.max(t, cursor);
    }
  }
  if (lyricLine) lyrics.push({ start: lyricStart, text: lyricLine.trim() });

  notes.sort((a, b) => a.start - b.start);
  for (const n of notes) delete n.tie;
  song.notes = notes;
  if (lyrics.length) song.lyrics = lyrics;
  if (tempo) song.bpm = Math.round(tempo);
  const key = detectKey(song);
  song.tonic = key.tonic;
  song.mode = key.mode;
  song.sa = 60 + key.tonic;
  return { song, warnings, skippedLines: [] };
}

function num(el: Element, sel: string): number {
  return parseFloat(el.querySelector(sel)?.textContent || '0') || 0;
}
