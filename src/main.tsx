import { render } from 'preact';
import { App } from './ui/App';
import { INSTRUMENTS, type InstrumentId } from './instruments';
import { builtinEdits, setPrefs } from './state';
import { libraryById } from './songs/library';
import { loadSong } from './songs/actions';
import { at } from './base';
import './styles.css';

// Deep links from the other pages: ?i=bansuri picks a flute, ?song=<id> loads a song.
const q = new URLSearchParams(location.search);
const i = q.get('i') as InstrumentId | null;
if (i && INSTRUMENTS[i]) setPrefs({ instrument: i });
const s = q.get('song');
if (s) {
  const song = libraryById(s, builtinEdits.value);
  if (song) loadSong(song);
}
if (i || s) history.replaceState(null, '', at(''));

render(<App />, document.getElementById('app')!);
