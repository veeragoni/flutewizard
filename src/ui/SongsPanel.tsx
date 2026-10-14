import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { librarySongs } from '../songs/library';
import { closeSong, listen, loadSong, playAlong } from '../songs/actions';
import { builtinEdits, editorSongId, instrument, mySongs, panel, root, showToast, songsTab, currentSourceSong } from '../state';
import { deleteSong, upsertSong } from '../songs/storage';
import { parseSongFile } from '../songs/parsers';
import { download, extFor, takes, type Take } from '../audio/recorder';
import { fitOctave, pitchRange, transposeSong, type Song } from '../music/song';
import { keyLabel } from '../music/theory';
import { IconDownload, IconEdit, IconHeadphones, IconPlay, IconPlus, IconTrash, IconUpload } from './icons';
import { Modal } from './Modal';
import { Artwork } from './Artwork';
import { track } from '../analytics';

export { Artwork };

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
                    <p>Folk favourites, classics, ragas and a film theme, set up with tempo and a backing groove. Listen first, then press Play and follow the fingerings. Slow the tempo down while you learn.</p>
                  </div>
                </div>
              ) : (
                <MyActions />
              )}
              <div class="search-row">
                <input type="search" placeholder="Find a song…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
                <button class="ghost-btn" onClick={() => { closeSong(); panel.value = null; }}>Free play</button>
              </div>
              <SongGrid songs={tab === 'library' ? librarySongs(builtinEdits.value) : mySongs.value} query={q} mine={tab === 'mine'} />
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
      track(`import/${res.song.source?.format ?? 'file'}`);
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
          <input ref={file} type="file" hidden accept=".mid,.midi,.musicxml,.mxl,.xml,.abc,.txt" onChange={(e) => { void onFile((e.target as HTMLInputElement).files?.[0]); (e.target as HTMLInputElement).value = ''; }} />
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
          {song.edited && <span class="tag on" title="You corrected this song's notes; Edit → Reset to original brings back the shipped version">Your version</span>}
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
            <>
              <button class="ghost-btn small" onClick={() => { loadSong(song); panel.value = 'sheet'; }}>Notes</button>
              <button class="ghost-btn small" onClick={() => { editorSongId.value = song.id; panel.value = 'editor'; }} title="Correct the notes; your version replaces this one for you"><IconEdit size={14} /> Edit</button>
            </>
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
