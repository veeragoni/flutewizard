import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { mxlToText, readZip } from '../src/songs/parsers/zip';

/** Builds a small zip archive (deflated entries, central directory) the way MuseScore writes .mxl files. */
function makeZip(files: Record<string, string>, store = false): ArrayBuffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text);
    const data = store ? raw : deflateRawSync(raw);
    const nameB = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(store ? 0 : 8, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameB.length, 28);
    cd.writeUInt32LE(offset, 42);
    chunks.push(local, nameB, data);
    central.push(cd, nameB);
    offset += local.length + nameB.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...chunks, cdBuf, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

const SCORE = '<?xml version="1.0"?><score-partwise><part id="P1"/></score-partwise>';

describe('.mxl (zipped MusicXML)', () => {
  it('finds the score named in META-INF/container.xml', async () => {
    const zip = makeZip({
      'META-INF/container.xml': '<container><rootfiles><rootfile full-path="score/song.xml"/></rootfiles></container>',
      'other.xml': '<nope/>',
      'score/song.xml': SCORE,
    });
    expect(await mxlToText(zip)).toBe(SCORE);
  });

  it('falls back to the first score file, and reads stored entries', async () => {
    const zip = makeZip({ 'song.musicxml': SCORE }, true);
    expect(readZip(zip).map((e) => e.name)).toEqual(['song.musicxml']);
    expect(await mxlToText(zip)).toBe(SCORE);
  });

  it('rejects files that are not zips', () => {
    expect(() => readZip(new TextEncoder().encode('hello there, not a zip at all').buffer)).toThrow(/not a zip/);
  });
});
