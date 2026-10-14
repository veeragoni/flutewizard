import { builtinSongs } from '../songs/library';
import { INSTRUMENT_ORDER, INSTRUMENTS, type InstrumentId } from '../instruments';
import { fitSong } from '../songs/fit';
import { notesByBar, type Song } from '../music/song';
import { keyLabel, noteName, sargamName } from '../music/theory';
import { FingeringDiagram } from '../ui/FingeringDiagram';
import { Artwork } from '../ui/Artwork';
import { at } from '../base';
import { PageShell } from './shell';

/**
 * The song library pages: the list at /songs/, and one page per song and flute at
 * /songs/<song>/ (concert flute) and /songs/<song>/<flute>/. Rendered to HTML at build time
 * (scripts/prerender.mjs) so search engines see the notes, then re-rendered in the browser.
 */
export interface SongsRoute {
  slug: string | null;
  inst: InstrumentId;
}

const slugOf = (s: Song) => s.id.replace(/^builtin-/, '');
const FLUTE_WORD: Record<InstrumentId, string> = { concert: 'flute', bansuri: 'bansuri', recorder: 'recorder', whistle: 'tin whistle' };

export function songPath(slug: string, inst: InstrumentId = 'concert') {
  return `songs/${slug}/${inst === 'concert' ? '' : inst + '/'}`;
}

/** Works out the page from the address: /songs/<song>/<flute>/, or the older /songs/?s=<song>. */
export function parseRoute(pathname: string, search: string): SongsRoute {
  const rest = pathname.slice(import.meta.env.BASE_URL.length).replace(/^songs\/?/, '');
  const [slugPart, instPart] = rest.split('/').filter(Boolean);
  const slug = slugPart ?? new URLSearchParams(search).get('s');
  const inst = (instPart && instPart in INSTRUMENTS ? instPart : new URLSearchParams(search).get('i') ?? 'concert') as InstrumentId;
  const exists = slug && builtinSongs().some((s) => slugOf(s) === slug);
  return { slug: exists ? slug : null, inst: inst in INSTRUMENTS ? inst : 'concert' };
}

/** Every page to pre-render. */
export function allRoutes(): SongsRoute[] {
  return [{ slug: null, inst: 'concert' }, ...builtinSongs().flatMap((s) => INSTRUMENT_ORDER.map((inst) => ({ slug: slugOf(s), inst })))];
}

export function pageMeta(route: SongsRoute): { title: string; description: string; path: string; jsonLd?: object } {
  if (!route.slug) {
    return {
      title: 'Easy Flute Songs with Notes & Fingerings | Flutely',
      description: 'Easy flute, bansuri, recorder and tin whistle songs with notes, fingerings and play-along backing tracks. Free, in your browser.',
      path: 'songs/',
    };
  }
  const src = builtinSongs().find((s) => slugOf(s) === route.slug)!;
  const inst = INSTRUMENTS[route.inst];
  const word = FLUTE_WORD[route.inst];
  const naming = inst.naming === 'sargam' ? 'sargam notes' : 'letter notes';
  return {
    title: `${src.title} ${word === 'flute' ? 'Flute' : word.replace(/\b\w/g, (c) => c.toUpperCase())} Notes & Fingering | Flutely`,
    description: `${src.title} on the ${word}: ${naming} with a fingering chart for every note, and a free play-along with backing band. ${src.blurb ?? ''}`.trim(),
    path: songPath(route.slug, route.inst),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MusicComposition',
      name: src.title,
      ...(src.artist && !/traditional|exercise/i.test(src.artist) ? { composer: { '@type': 'Person', name: src.artist } } : {}),
      ...(src.tags?.length ? { genre: src.tags.join(', ') } : {}),
      description: src.blurb,
    },
  };
}

export function SongsView({ route, root }: { route: SongsRoute; root?: number }) {
  if (route.slug) return <SongPage slug={route.slug} instId={route.inst} root={root} />;
  const songs = builtinSongs();
  return (
    <PageShell title="Easy flute songs" intro="Public-domain tunes, folk favourites, ragas and exercises for flute, bansuri, recorder and tin whistle. Each comes with notes, fingerings and a play-along with a backing band.">
      <div class="song-list">
        {songs.map((s) => (
          <div class="song-row">
            <a href={at(songPath(slugOf(s)))} aria-label={s.title}><Artwork song={s} size={64} /></a>
            <div>
              <a href={at(songPath(slugOf(s)))}><b>{s.title}</b></a> <span class="muted">({s.artist})</span>
              <div class="muted small-text">{s.blurb}</div>
              <div class="tags">
                {INSTRUMENT_ORDER.map((id) => <a class="tag" href={at(songPath(slugOf(s), id))}>{FLUTE_WORD[id]}</a>)}
                {(s.tags ?? []).map((t) => <span class="tag muted">{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function SongPage({ slug, instId, root: rootIn }: { slug: string; instId: InstrumentId; root?: number }) {
  const src = builtinSongs().find((s) => slugOf(s) === slug)!;
  const inst = INSTRUMENTS[instId];
  const root = rootIn !== undefined && inst.keyOptions.some((k) => k.root === rootIn) ? rootIn : inst.defaultKey;
  const song = fitSong(src, inst, root);
  const name = (m: number) => (inst.naming === 'sargam' ? sargamName(m, root) : noteName(m, { octave: false }));
  const bars = notesByBar(song);
  const seen = new Set<number>();
  const used = [...new Set(song.notes.filter((n) => n.midi !== null).map((n) => n.midi!))].sort((a, b) => a - b);
  const word = FLUTE_WORD[instId];
  const keyText = inst.keyOptions.length > 1 ? ` (${inst.keyOptions.find((k) => k.root === root)?.label})` : '';
  return (
    <PageShell title={`${src.title}: ${word} notes`} intro={src.blurb}>
      <p class="muted">
        {src.artist} · {src.source?.format === 'sargam' ? 'Sargam' : keyLabel(song.tonic, song.mode)} · {Math.round(song.bpm)} BPM ·{' '}
        {song.time[0]}/{song.time[1]} · shown for <b>{inst.name}</b>{keyText}
      </p>
      <nav class="tags flute-tabs" aria-label="Other flutes">
        {INSTRUMENT_ORDER.map((id) => (
          <a class={'tag' + (id === instId ? ' on' : '')} href={at(songPath(slug, id))} aria-current={id === instId ? 'page' : undefined}>
            {INSTRUMENTS[id].name}
          </a>
        ))}
      </nav>
      <a class="primary-btn" href={at(`?song=${src.id}&i=${instId}`)}>Play along on the virtual {word}</a>

      <h2>Notes</h2>
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

      <h2>Fingerings you need</h2>
      <p class="muted">
        {src.title} uses {used.length} notes on the {word}: {used.map(name).join(', ')}.
        {inst.naming === 'sargam' ? ' Notes are in sargam, with Sa on the three-hole note of your bansuri.' : ''}
      </p>
      <div class="fingering-strip">
        {used.map((m) => (
          <figure>
            <FingeringDiagram inst={inst} fingering={inst.fingering(m, root)} size={0.8} />
            <figcaption>{name(m)}</figcaption>
          </figure>
        ))}
      </div>
      <p><a href={at('songs/')}>← All songs</a> · <a href={at(`fingering-charts/?i=${instId}`)}>Full {word} fingering chart</a></p>
    </PageShell>
  );
}
