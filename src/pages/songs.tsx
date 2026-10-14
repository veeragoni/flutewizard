import { render } from 'preact';
import { builtinSongs } from '../songs/library';
import { INSTRUMENTS } from '../instruments';
import { prefs } from '../state';
import { fitSong } from '../songs/fit';
import { notesByBar } from '../music/song';
import { keyLabel, noteName, sargamName } from '../music/theory';
import { FingeringDiagram } from '../ui/FingeringDiagram';
import { Artwork } from '../ui/SongsPanel';
import { PageShell } from './shell';
import '../styles.css';
import './pages.css';

/** Song library pages: the list, and one page per song with notes and fingerings. */
function SongsPage() {
  const id = new URLSearchParams(location.search).get('s');
  const songs = builtinSongs();
  const song = id ? songs.find((s) => s.id === 'builtin-' + id) : null;
  if (song) return <SongPage songId={song.id} />;
  return (
    <PageShell title="Easy flute songs" intro="Public-domain tunes, folk favourites, ragas and exercises for flute, bansuri, recorder and tin whistle. Each comes with notes, fingerings and a play-along with a backing band.">
      <div class="song-list">
        {songs.map((s) => (
          <a class="song-row" href={`/songs/?s=${s.id.replace('builtin-', '')}`}>
            <Artwork song={s} size={64} />
            <div>
              <b>{s.title}</b> <span class="muted">({s.artist})</span>
              <div class="muted small-text">{s.blurb}</div>
              <div class="tags">{(s.tags ?? []).map((t) => <span class="tag">{t}</span>)}</div>
            </div>
          </a>
        ))}
      </div>
    </PageShell>
  );
}

function SongPage({ songId }: { songId: string }) {
  const src = builtinSongs().find((s) => s.id === songId)!;
  const inst = INSTRUMENTS[prefs.value.instrument];
  const root = prefs.value.keys[inst.id] ?? inst.defaultKey;
  const song = fitSong(src, inst, root);
  const name = (m: number) => (inst.naming === 'sargam' ? sargamName(m, root) : noteName(m, { octave: false }));
  const bars = notesByBar(song);
  const seen = new Set<number>();
  document.title = `${song.title} – ${inst.name} notes & fingering | Flutely`;
  return (
    <PageShell title={`${song.title}: ${inst.name.toLowerCase()} notes`} intro={src.blurb}>
      <p class="muted">{song.artist} · {src.source?.format === 'sargam' ? 'Sargam' : keyLabel(song.tonic, song.mode)} · {Math.round(song.bpm)} BPM · {song.time[0]}/{song.time[1]} · shown for <b>{inst.name}</b>{inst.keyOptions.length > 1 ? ` (${inst.keyOptions.find((k) => k.root === root)?.label})` : ''}</p>
      <a class="primary-btn" href={`/?song=${song.id}`}>Play along in the virtual flute</a>
      <div class="sheet-bars page-sheet">
        {bars.map((notes, i) => (
          <div class="sheet-bar">
            <div class="sheet-num">{i + 1}</div>
            <div class="sheet-notes">
              {notes.map((n) => {
                if (n.midi === null) return <span class="sn rest" style={{ flexGrow: n.dur }}>·</span>;
                const first = !seen.has(n.midi);
                seen.add(n.midi);
                return (
                  <span class="sn" style={{ flexGrow: n.dur }}>
                    {first && <FingeringDiagram inst={inst} fingering={inst.fingering(n.midi, root)} size={0.6} />}
                    <b>{name(n.midi)}</b>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p><a href="/songs/">← All songs</a></p>
    </PageShell>
  );
}

render(<SongsPage />, document.getElementById('app')!);
