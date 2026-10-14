import { render } from 'preact';
import { App } from './ui/App';
import { INSTRUMENTS, type InstrumentId } from './instruments';
import { setPrefs } from './state';
import { builtinById } from './songs/library';
import { loadSong } from './songs/actions';
import './styles.css';

// Deep links from the other pages: ?i=bansuri picks a flute, ?song=<id> loads a song.
const q = new URLSearchParams(location.search);
const i = q.get('i') as InstrumentId | null;
if (i && INSTRUMENTS[i]) setPrefs({ instrument: i });
const s = q.get('song');
if (s) {
  const song = builtinById(s);
  if (song) loadSong(song);
}
if (i || s) history.replaceState(null, '', '/');

render(<App />, document.getElementById('app')!);
