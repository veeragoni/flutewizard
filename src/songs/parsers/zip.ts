/**
 * Just enough of the zip format to open compressed MusicXML (.mxl): reads the central directory and
 * inflates entries with the browser's DecompressionStream.
 */
export interface ZipEntry {
  name: string;
  read(): Promise<Uint8Array>;
}

export function readZip(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  // End of central directory record: scan back past an optional comment.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This file is not a zip archive.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('This zip archive is damaged.');
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    entries.push({
      name,
      async read() {
        const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
        const data = new Uint8Array(buf, start, size);
        if (method === 0) return data.slice();
        if (method !== 8) throw new Error(`Unsupported compression in ${name}.`);
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      },
    });
  }
  return entries;
}

/** The score inside a .mxl: the rootfile named in META-INF/container.xml, else the first .xml/.musicxml. */
export async function mxlToText(buf: ArrayBuffer): Promise<string> {
  const entries = readZip(buf);
  const dec = new TextDecoder();
  let path: string | null = null;
  const container = entries.find((e) => e.name === 'META-INF/container.xml');
  if (container) path = /full-path\s*=\s*"([^"]+)"/.exec(dec.decode(await container.read()))?.[1] ?? null;
  const entry = entries.find((e) => e.name === path)
    ?? entries.find((e) => !e.name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(e.name));
  if (!entry) throw new Error('No score found inside this .mxl file.');
  return dec.decode(await entry.read());
}
