import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { builtinSongs } from '../songs/library';
import { closeSong, listen, loadSong, playAlong } from '../songs/actions';
import { editorSongId, instrument, mySongs, panel, root, showToast, songsTab, currentSourceSong } from '../state';
import { deleteSong, upsertSong } from '../songs/storage';
import { parseSongFile } from '../songs/parsers';
import { download, extFor, takes, type Take } from '../audio/recorder';
import { fitOctave, pitchRange, transposeSong, type Song } from '../music/song';
import { keyLabel } from '../music/theory';
import { IconDownload, IconEdit, IconHeadphones, IconPlay, IconPlus, IconTrash, IconUpload } from './icons';
import { Modal } from './Modal';

export function SongsPanel() {
  const tab = songsTab.value;
  const [q, setQ] = useState('');
  return (
    <Modal title="Songs & recordings" onClose={() => (panel.value = null)} wide>
      <div class="songs-layout">
        <nav class="songs-tabs">
          <button class={tab === 'mine' ? 'on' : ''} onClick={() => (songsTab.value = 'mine')}>My songs</button>
          <button class={tab === 'library' ? 'on' : ''} onClick={() => (songsTab.value = 'library')}>Popular tunes</button>
          <button class={tab === 'recordings' ? 'on' : ''} onClick={() => (songsTab.value = 'recordings')}>Recordings</button>
        </nav>
        <div class="songs-body">
          {tab === 'recordings' ? <Recordings /> : (
            <>
              {tab === 'library' ? (
                <div class="callout">
                  <span class="callout-icon">♪</span>
                  <div>
                    <b>Play along</b>
                    <p>Public-domain tunes, folk favourites and ragas, set up with tempo and a backing groove. Listen first, then press Play and follow the fingerings. Slow the tempo down while you learn.</p>
                  </div>
                </div>
              ) : (
                <MyActions />
              )}
              <div class="search-row">
                <input type="search" placeholder="Find a song…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
                <button class="ghost-btn" onClick={() => { closeSong(); panel.value = null; }}>Free play</button>
              </div>
              <SongGrid songs={tab === 'library' ? builtinSongs() : mySongs.value} query={q} mine={tab === 'mine'} />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MyActions() {
  const file = useRef<HTMLInputElement>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const res = await parseSongFile(f);
      if (!res.song.notes.length) {
        showToast('No notes found in that file.');
        return;
      }
      mySongs.value = upsertSong(mySongs.value, res.song);
      editorSongId.value = res.song.id;
      panel.value = 'editor';
      if (res.warnings.length) showToast(res.warnings[0].message);
    } catch (e) {
      showToast((e as Error).message || 'Could not read that file.');
    }
  };
  return (
    <div class="callout">
      <span class="callout-icon">✎</span>
      <div style={{ flex: 1 }}>
        <b>Your songs</b>
        <p>Paste notes in letters (C D E), Sargam (Sa Re Ga) or ABC, or import a MIDI or MusicXML file. Lyrics lines are kept for display. Songs are saved in this browser.</p>
        <div class="row-gap">
          <button class="primary-btn" onClick={() => { editorSongId.value = null; panel.value = 'editor'; }}><IconPlus size={16} /> New song</button>
          <button class="ghost-btn" onClick={() => file.current?.click()}><IconUpload size={16} /> Import file</button>
          <input ref={file} type="file" hidden accept=".mid,.midi,.musicxml,.xml,.abc,.txt" onChange={(e) => { void onFile((e.target as HTMLInputElement).files?.[0]); (e.target as HTMLInputElement).value = ''; }} />
        </div>
      </div>
    </div>
  );
}

function SongGrid({ songs, query, mine }: { songs: Song[]; query: string; mine: boolean }) {
  const q = query.trim().toLowerCase();
  const list = songs.filter((s) => !q || (s.title + ' ' + (s.artist ?? '') + ' ' + (s.tags ?? []).join(' ')).toLowerCase().includes(q));
  if (!list.length) {
    return <div class="empty-note">{mine && !q ? 'No songs yet. Write one or import a file.' : 'No songs match.'}</div>;
  }
  return (
    <div class="song-grid">
      {list.map((s) => <SongCard song={s} mine={mine} />)}
    </div>
  );
}

function SongCard({ song, mine }: { song: Song; mine: boolean }) {
  const inst = instrument.value;
  const r = root.value;
  const fit = useMemo(() => {
    const [lo, hi] = inst.range(r);
    const moved = transposeSong(song, fitOctave(song, lo, hi));
    const missing = moved.notes.filter((n) => n.midi !== null && !inst.fingering(n.midi, r)).length;
    return { missing };
  }, [song, inst, r]);
  const loaded = currentSourceSong.value?.id === song.id;
  const range = pitchRange(song);
  return (
    <article class={'song-card' + (loaded ? ' loaded' : '')}>
      <Artwork song={song} />
      <div class="song-info">
        <h3>{song.title}{song.artist ? <span> ({song.artist})</span> : null}</h3>
        <div class="song-meta">
          {song.source?.format === 'sargam' ? 'Sargam' : keyLabel(song.tonic, song.mode)} · {Math.round(song.bpm)} BPM · {song.time[0]}/{song.time[1]}
          {range && <> · {range[1] - range[0] + 1} semitones</>}
        </div>
        {song.blurb && <p class="song-blurb">{song.blurb}</p>}
        <div class="tags">
          {(song.tags ?? []).map((t) => <span class="tag">{t}</span>)}
          {fit.missing > 0 && <span class="tag warn" title="Some notes have no fingering on this flute in this key">{fit.missing} hard notes</span>}
        </div>
        <div class="card-actions">
          {mine ? (
            <>
              <button class="ghost-btn small" onClick={() => { editorSongId.value = song.id; panel.value = 'editor'; }}><IconEdit size={14} /> Edit</button>
              <button
                class="ghost-btn small"
                onClick={() => {
                  if (!confirmDelete(song.title)) return;
                  mySongs.value = deleteSong(mySongs.value, song.id);
                }}
              ><IconTrash size={14} /></button>
            </>
          ) : (
            <button class="ghost-btn small" onClick={() => { loadSong(song); panel.value = 'sheet'; }}>Notes</button>
          )}
          <span class="spacer" />
          <button class="icon-btn round" onClick={() => listen(song)} title="Listen"><IconHeadphones size={18} /></button>
          <button class="play-pill" onClick={() => playAlong(song)}><IconPlay size={14} /> Play</button>
        </div>
      </div>
    </article>
  );
}

// Deleting is permanent, so ask (in-page, not a browser dialog).
let pendingDelete: string | null = null;
function confirmDelete(title: string): boolean {
  if (pendingDelete === title) {
    pendingDelete = null;
    return true;
  }
  pendingDelete = title;
  showToast(`Press delete again to remove "${title}".`);
  setTimeout(() => (pendingDelete = null), 4000);
  return false;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Generated cover art: colour from the title, a motif from the tags. */
export function Artwork({ song, size = 92 }: { song: Song; size?: number }) {
  const h = hash(song.title);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h >> 8) % 60) % 360;
  const tags = song.tags ?? [];
  const motif = tags.includes('Raga') ? 'lotus' : tags.includes('Irish') || tags.includes('Folk') ? 'hills' : tags.includes('Classical') ? 'staff' : tags.includes('Holiday') ? 'stars' : 'waves';
  const id = 'art' + h;
  return (
    <svg class="art" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={`hsl(${hue} 55% 42%)`} />
          <stop offset="1" stop-color={`hsl(${hue2} 60% 22%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="10" fill={`url(#${id})`} />
      {motif === 'waves' && [0, 1, 2, 3].map((i) => <path d={`M-5 ${58 + i * 11} Q 25 ${46 + i * 11} 50 ${58 + i * 11} T 105 ${58 + i * 11}`} stroke="rgba(255,255,255,0.22)" stroke-width="3" fill="none" />)}
      {motif === 'hills' && <><path d="M0 75 Q 30 45 55 70 T 100 60 V100 H0Z" fill="rgba(0,0,0,0.25)" /><path d="M0 85 Q 40 60 70 82 T 100 78 V100 H0Z" fill="rgba(0,0,0,0.3)" /><circle cx="72" cy="30" r="10" fill="rgba(255,240,200,0.6)" /></>}
      {motif === 'staff' && [0, 1, 2, 3, 4].map((i) => <line x1="8" x2="92" y1={40 + i * 8} y2={40 + i * 8} stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />)}
      {motif === 'staff' && <><circle cx="35" cy="60" r="5" fill="rgba(255,255,255,0.7)" /><line x1="40" x2="40" y1="60" y2="32" stroke="rgba(255,255,255,0.7)" stroke-width="2" /><circle cx="62" cy="48" r="5" fill="rgba(255,255,255,0.7)" /><line x1="67" x2="67" y1="48" y2="22" stroke="rgba(255,255,255,0.7)" stroke-width="2" /></>}
      {motif === 'lotus' && [-50, -25, 0, 25, 50].map((a) => <ellipse cx="50" cy="52" rx="8" ry="22" transform={`rotate(${a} 50 70)`} fill="rgba(255,220,230,0.35)" />)}
      {motif === 'stars' && [[25, 30], [70, 22], [50, 50], [80, 60], [20, 70]].map(([x, y]) => <path d={`M${x} ${y - 6} L${x + 1.8} ${y - 1.8} L${x + 6} ${y} L${x + 1.8} ${y + 1.8} L${x} ${y + 6} L${x - 1.8} ${y + 1.8} L${x - 6} ${y} L${x - 1.8} ${y - 1.8}Z`} fill="rgba(255,250,220,0.75)" />)}
      <text x="10" y="28" font-size="22" font-weight="700" fill="rgba(255,255,255,0.9)" font-family="Inter, sans-serif">{song.title.replace(/^(The|A)\s+/, '')[0]}</text>
    </svg>
  );
}

function Recordings() {
  const [list, setList] = useState<Take[] | null>(null);
  const refresh = () => void takes.list().then(setList);
  useEffect(refresh, []);
  if (!list) return <div class="empty-note">Loading…</div>;
  if (!list.length) return <div class="empty-note">No recordings yet. Press the record button on the right to capture a take (up to 10 minutes).</div>;
  return (
    <div class="take-list">
      {list.map((t) => <TakeRow take={t} onChange={refresh} />)}
    </div>
  );
}

function TakeRow({ take, onChange }: { take: Take; onChange: () => void }) {
  const url = useMemo(() => URL.createObjectURL(take.compressed ?? take.wav), [take]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [name, setName] = useState(take.name);
  const base = name.replace(/[^\w\- ]+/g, '').trim() || 'flute-take';
  return (
    <div class="take">
      <div class="take-head">
        <input
          type="text" value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onBlur={() => void takes.save({ ...take, name }).then(onChange)}
        />
        <small>{new Date(take.created).toLocaleString()} · {formatTime(take.seconds)} · {take.instrument}{take.song ? ` · ${take.song}` : ''}</small>
      </div>
      <audio controls src={url} preload="none" />
      <div class="row-gap">
        <button class="ghost-btn small" onClick={() => download(take.wav, `${base}.wav`)}><IconDownload size={14} /> WAV</button>
        {take.compressed && <button class="ghost-btn small" onClick={() => download(take.compressed!, `${base}.${extFor(take.compressed!)}`)}><IconDownload size={14} /> {extFor(take.compressed).toUpperCase()}</button>}
        <button class="ghost-btn small" onClick={() => { if (confirmDelete(take.name)) void takes.remove(take.id).then(onChange); }}><IconTrash size={14} /></button>
      </div>
    </div>
  );
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
