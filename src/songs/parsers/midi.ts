import { detectKey, emptySong, type ParseResult, type ParseWarning, type SongNote } from '../../music/song';

/**
 * Standard MIDI File import. Picks the track that looks most like a melody (most notes in a
 * singing range with little overlap), then keeps only the top voice where notes overlap.
 */

interface RawNote { midi: number; startTick: number; endTick: number; vel: number }
interface Track { name: string; notes: RawNote[]; channel: number }

export function parseMidi(buf: ArrayBuffer, fileName = 'MIDI file'): ParseResult {
  const warnings: ParseWarning[] = [];
  const v = new DataView(buf);
  let p = 0;
  const str = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(p + i)); p += n; return s; };
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  const u8 = () => v.getUint8(p++);
  const vlq = () => { let x = 0, b; do { b = u8(); x = (x << 7) | (b & 0x7f); } while (b & 0x80); return x; };

  if (str(4) !== 'MThd') throw new Error('Not a MIDI file.');
  const hdrLen = u32();
  u16(); // format
  const nTracks = u16();
  const division = u16();
  p = 8 + hdrLen;
  if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported.');
  const tpq = division;

  const tempos: { tick: number; uspq: number }[] = [];
  let timeSig: [number, number] | null = null;
  let title = '';
  const tracks: Track[] = [];

  for (let t = 0; t < nTracks && p < buf.byteLength; t++) {
    if (str(4) !== 'MTrk') break;
    const len = u32();
    const end = p + len;
    let tick = 0;
    let status = 0;
    const open = new Map<number, RawNote>();
    const track: Track = { name: '', notes: [], channel: -1 };
    while (p < end) {
      tick += vlq();
      let b = u8();
      if (b < 0x80) { p--; b = status; } else if (b < 0xf0) status = b;
      const type = b & 0xf0;
      const ch = b & 0x0f;
      if (b === 0xff) {
        const mt = u8();
        const ml = vlq();
        if (mt === 0x51 && ml === 3) tempos.push({ tick, uspq: (v.getUint8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2) });
        if (mt === 0x58 && ml >= 2 && !timeSig) timeSig = [v.getUint8(p), Math.pow(2, v.getUint8(p + 1))];
        if (mt === 0x03) { const s0 = p; track.name = str(ml); p = s0; if (!title && t === 0) title = track.name; }
        p += ml;
      } else if (b === 0xf0 || b === 0xf7) {
        p += vlq();
      } else if (type === 0x90 || type === 0x80) {
        const note = u8(), vel = u8();
        const k = ch * 128 + note;
        if (type === 0x90 && vel > 0) {
          const prev = open.get(k);
          if (prev) { prev.endTick = tick; track.notes.push(prev); }
          open.set(k, { midi: note, startTick: tick, endTick: tick, vel });
          if (ch !== 9) track.channel = ch;
        } else {
          const n = open.get(k);
          if (n) { n.endTick = tick; open.delete(k); if (ch !== 9) track.notes.push(n); }
        }
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        p += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        p += 1;
      } else {
        break;
      }
    }
    p = end;
    if (track.notes.length) tracks.push(track);
  }

  if (!tracks.length) throw new Error('No notes found in this MIDI file.');

  // Score each track for "melody-ness".
  const scored = tracks.map((tr) => {
    const mean = tr.notes.reduce((a, n) => a + n.midi, 0) / tr.notes.length;
    const sorted = [...tr.notes].sort((a, b) => a.startTick - b.startTick);
    let overlap = 0;
    for (let i = 1; i < sorted.length; i++) if (sorted[i].startTick < sorted[i - 1].endTick - tpq / 8) overlap++;
    const poly = overlap / sorted.length;
    const rangeFit = mean >= 55 && mean <= 90 ? 1 : 0.4;
    const nameBonus = /melod|lead|flute|vocal|voice|sing|solo|right/i.test(tr.name) ? 2 : 1;
    return { tr, score: Math.log(1 + tr.notes.length) * rangeFit * (1 - poly * 0.8) * nameBonus };
  });
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].tr;
  if (tracks.length > 1) {
    warnings.push({ line: 0, message: `Used the melody from track "${chosen.name || 'unnamed'}" (${tracks.length} tracks in the file).` });
  }

  // Skyline: at each onset keep the highest note; cut notes when the next one starts.
  const byStart = new Map<number, RawNote>();
  for (const n of chosen.notes) {
    const cur = byStart.get(n.startTick);
    if (!cur || n.midi > cur.midi) byStart.set(n.startTick, n);
  }
  const mono = [...byStart.values()].sort((a, b) => a.startTick - b.startTick);
  const notes: SongNote[] = [];
  let lastEnd = mono.length ? mono[0].startTick : 0;
  const origin = 0;
  for (let i = 0; i < mono.length; i++) {
    const n = mono[i];
    const next = mono[i + 1];
    const endTick = next ? Math.min(n.endTick, next.startTick) : n.endTick;
    if (n.startTick > lastEnd + tpq / 16) notes.push({ midi: null, start: (lastEnd - origin) / tpq, dur: (n.startTick - lastEnd) / tpq });
    notes.push({ midi: n.midi, start: (n.startTick - origin) / tpq, dur: Math.max(1 / 16, (endTick - n.startTick) / tpq) });
    lastEnd = Math.max(lastEnd, endTick);
  }
  // Drop leading silence to the nearest bar.
  const song = emptySong();
  if (timeSig) song.time = timeSig;
  const barLen = (song.time[0] * 4) / song.time[1];
  const firstNote = notes.find((n) => n.midi !== null);
  const shift = firstNote ? Math.floor(firstNote.start / barLen) * barLen : 0;
  song.notes = notes.filter((n) => n.midi !== null || n.start >= shift).map((n) => ({ ...n, start: n.start - shift }))
    .filter((n) => !(n.midi === null && n.start < 0));
  song.bpm = Math.round(tempos.length ? 60_000_000 / tempos.sort((a, b) => a.tick - b.tick)[0].uspq : 120);
  if (new Set(tempos.map((t) => t.uspq)).size > 1) warnings.push({ line: 0, message: 'The file changes tempo; the first tempo is used throughout.' });
  song.title = title || fileName.replace(/\.(mid|midi)$/i, '');
  song.source = { format: 'midi', text: '' };
  const key = detectKey(song);
  song.tonic = key.tonic;
  song.mode = key.mode;
  song.sa = 60 + key.tonic;
  return { song, warnings, skippedLines: [] };
}
