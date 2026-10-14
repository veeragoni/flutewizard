// Usage: node scripts/build-samples.mjs <raw dir> public/samples <raw2 dir>  (needs ffmpeg; raw downloads are not in the repo)
// Cuts, levels and encodes the raw recordings into web sample sets + manifests.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { decode, track, segments } from './analyze-samples.mjs';
const [, , RAW, OUT, RAW2] = process.argv;
const SR = 44100;

function cut(src, start, end, dest, { maxLen = 3.5, gainDb = 0 } = {}) {
  const len = Math.min(end - start, maxLen);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, start)), '-t', String(len), '-i', src,
    '-ac', '1', '-ar', String(SR),
    '-af', `volume=${gainDb}dB,afade=t=in:d=0.004,afade=t=out:st=${Math.max(0, len - 0.04)}:d=0.04`,
    '-c:a', 'libmp3lame', '-b:a', '160k', dest]);
}
function rmsDb(file, start, len) {
  const x = decode(file);
  const a = Math.floor(start * SR), b = Math.min(x.length, a + Math.floor(len * SR));
  let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / Math.max(1, b - a) + 1e-12);
}
const TARGET = -18; // dB RMS for the steady part of every note

function buildSet(id, credit, license, items) {
  mkdirSync(`${OUT}/${id}`, { recursive: true });
  const notes = [];
  for (const it of items) {
    const level = rmsDb(it.src, it.start + 0.15, Math.min(1, it.end - it.start - 0.2));
    const name = `${it.midi}.mp3`;
    cut(it.src, it.start, it.end, `${OUT}/${id}/${name}`, { maxLen: it.maxLen ?? 3.5, gainDb: TARGET - level });
    notes.push({ midi: it.midi, url: `${id}/${name}`, cents: it.cents ?? 0 });
  }
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify({ id, credit, license, notes }, null, 1));
  console.log(id, notes.length, 'notes');
}

// Measure the note boundaries from the audio itself.
function measured(file, pick = 0) {
  const segs = segments(track(decode(file)));
  return segs[pick];
}
const auto = (file, midi, opts = {}) => {
  const s = measured(file, opts.seg ?? 0);
  return { src: file, start: Math.max(0, s.start - 0.06), end: s.end + 0.05, midi, cents: s.cents + (s.note - midi) * 100, ...opts };
};

// Concert flute: VSCO 2 CE, files named an octave low (C3 = middle C).
const fl = [['C3', 60], ['E3', 64], ['A3', 69], ['C4', 72], ['E4', 76], ['A4', 81], ['C5', 84], ['E5', 88], ['A5', 93], ['C6', 96]];
buildSet('concert', 'Flute: VS Chamber Orchestra Community Edition, Versilian Studios / Ivy Audio (vis.versilstudios.com)', 'CC0 1.0',
  fl.map(([n, m]) => auto(`${RAW}/flute/${n}.wav`, m)));

// Recorder: VCSL soprano recorder, written pitch an octave below sounding.
const rc = [['C4', 72], ['D4', 74], ['E4', 76], ['F#4', 78], ['G#4', 80], ['A#4', 82], ['C5', 84], ['D5', 86], ['E5', 88], ['F#5', 90], ['G5', 91], ['A#5', 94], ['C6', 96]];
buildSet('recorder', 'Recorder: Versilian Community Sample Library, Versilian Studios', 'CC0 1.0',
  rc.map(([n, m]) => auto(`${RAW}/recorder/${n}.wav`, m, { seg: n === 'A#5' ? 1 : 0 })));

// Tin whistle: cernoel "Waltons Irish ThinWhistle in D" (Freesound pack 22189).
const tw = [[394740, 74], [394738, 76], [394737, 78], [394741, 79], [394736, 81], [394735, 83], [394733, 84], [394734, 85], [394739, 86]];
// Second octave, cut from tune recordings (notes end where the next begins, so no extra tail).
const W2 = (f) => `${RAW2}/whistle/${f}`;
const at2 = (f, start, end, midi, cents) => ({ src: W2(f), start: start - 0.02, end: end + 0.02, midi, cents, maxLen: 2.2 });
buildSet('whistle', 'Tin whistle: "Waltons Irish ThinWhistle in D" by cernoel (CC0); E6 from "scarborough_2" by tychobrailleur (CC BY 4.0); F#6–B6 from "Danny Boy tin whistle" by Jules Grandgagnage (CC BY-SA 4.0)', 'CC0 1.0 / CC BY 4.0 / CC BY-SA 4.0', [
  ...tw.map(([id, m]) => ({ ...auto(`${RAW}/whistle/${id}.mp3`, m), end: measured(`${RAW}/whistle/${id}.mp3`).end + 0.35, maxLen: 1.6 })),
  at2('tycho-255593.mp3', 0.36, 1.58, 88, 26),
  at2('dannyboy.ogg', 48.44, 49.32, 90, -2),
  at2('dannyboy.ogg', 46.5, 48.32, 91, -4),
  at2('dannyboy.ogg', 68.54, 69.64, 93, 17),
  at2('dannyboy.ogg', 66.88, 68.34, 95, 20),
]);

// Bansuri: sankalp (Freesound), Sa ≈ E4 + 40 cents. Slices from the long notes and the scale.
const B = (id) => `${RAW}/bansuri/${id}.mp3`;
const seg = (id, start, end, midi, cents) => ({ src: B(id), start: start - 0.06, end: end + 0.04, midi, cents });
buildSet('bansuri', 'Bansuri recordings by sankalp (freesound.org/people/sankalp), CC BY 4.0, and roguentropy ("Flute Sargams", CC0). Modified: sliced, trimmed, levelled, looped and re-encoded.', 'CC BY 4.0 / CC0 1.0', [
  seg(179695, 3.92, 10.76, 64, 39),
  seg(179693, 16.06, 16.98, 66, -2),
  seg(179693, 2.56, 3.48, 68, 11),
  seg(179693, 3.5, 4.48, 69, 16),
  seg(179693, 4.54, 5.5, 71, 12),
  seg(179693, 5.52, 6.46, 73, 0),
  seg(179693, 6.5, 7.38, 75, -19),
  seg(179696, 0.82, 8.98, 76, 22),
  seg(179694, 9.7, 14.58, 83, 68),
  // Upper-octave gap filled from roguentropy's CC0 "Flute Sargams" (an F# bansuri: its Ni and taar Sa).
  { src: `${RAW2}/bansuri/roguentropy-844538.mp3`, start: 5.44 - 0.04, end: 6.28 + 0.03, midi: 78, cents: -27 },
  { src: `${RAW2}/bansuri/roguentropy-844538.mp3`, start: 7.14 - 0.04, end: 7.94 + 0.03, midi: 79, cents: -23 },
]);
