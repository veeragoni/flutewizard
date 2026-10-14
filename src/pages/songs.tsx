import { render } from 'preact';
import { prefs } from '../state';
import { pageMeta, parseRoute, SongsView } from './songsView';
import '../styles.css';
import './pages.css';

// Browser entry for the song pages; the same view is pre-rendered at build time.
const route = parseRoute(location.pathname, location.search);
document.title = pageMeta(route).title;
render(<SongsView route={route} root={prefs.value.keys[route.inst]} />, document.getElementById('app')!);
