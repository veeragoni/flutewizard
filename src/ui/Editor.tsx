import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { editorSongId, instrument, mySongs, panel, prefs, root, setPrefs, songsTab, naming, showToast } from '../state';
import { builtinById } from '../songs/library';
import { upsertSong } from '../songs/storage';
import { detectTextFormat, parseSongText, songToText, type TextFormat } from '../songs/parsers';
import { bestTranspose, fitSong, hardNotes } from '../songs/fit';
import { playAlong } from '../songs/actions';
import { GROOVES } from '../audio/backing';
import { barLength, newId, notesByBar, pitchRange, type ParseResult, type Song } from '../music/song';
import { keyLabel, noteName } from '../music/theory';
import { FingeringDiagram } from './FingeringDiagram';
import { label } from './names';
import { Modal } from './Modal';
import { IconBack, IconPlay } from './icons';

const STARTER = `Title: My song
Artist:
Tempo: 90
Time: 4/4

[Verse]
E E F G | G F E D | C C D E | E- D- |
`;

const SARGAM_STARTER = `Title: My song
Tempo: 80
Time: 4/4

[Sthayi]
Sa Re Ga Ma | Pa- Pa- | Dha Pa Ma Ga | Re- Sa- |
`;

type FormatChoice = 'auto' | TextFormat;

interface Draft {
  id: string;
  text: string;
  format: FormatChoice;
  groove: string;
  transpose: number;
  tags: string[];
  drone?: boolean;
}

function draftFor(id: string | null): { draft: Draft; fromBuiltin: boolean } {
  const fresh = (): Draft => ({
    id: newId(),
    text: naming.value === 'sargam' ? SARGAM_STARTER : STARTER,
    format: 'auto',
    groove: 'auto',
    transpose: 0,
    tags: [],
  });
  if (!id) return { draft: fresh(), fromBuiltin: false };
  const mine = mySongs.value.find((s) => s.id === id);
  const built = mine ? null : builtinById(id);
  const s = mine ?? built;
  if (!s) return { draft: fresh(), fromBuiltin: false };
  let text = s.source?.text ?? '';
  let format: FormatChoice = (s.source?.format as TextFormat) ?? 'auto';
  if (!text || s.source?.format === 'midi' || s.source?.format === 'musicxml') {
    // Imported files have no text: write the notes out so they can be edited.
    const f = naming.value === 'sargam' ? 'sargam' : 'letters';
    text = songToText(s, f);
    format = f;
  }
  return {
    draft: { id: built ? newId() : s.id, text, format, groove: s.groove ?? 'auto', transpose: s.transpose ?? 0, tags: s.tags ?? [], drone: s.drone },
    fromBuiltin: !!built,
  };
}

export function Editor() {
  const initial = useMemo(() => draftFor(editorSongId.value), []);
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [saved, setSaved] = useState<'saved' | 'dirty' | 'new'>(editorSongId.value && !initial.fromBuiltin ? 'saved' : 'new');
  const [showHelp, setShowHelp] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const inst = instrument.value;
  const r = root.value;

  const format: TextFormat = draft.format === 'auto' ? detectTextFormat(draft.text) : draft.format;
  const result: ParseResult = useMemo(() => {
    try {
      return parseSongText(draft.text, format, { sa: undefined });
    } catch (e) {
      return { song: { ...parseSongText('', 'letters').song }, warnings: [{ line: 0, message: (e as Error).message }], skippedLines: [] };
    }
  }, [draft.text, format]);

  const song: Song = useMemo(() => ({
    ...result.song,
    id: draft.id,
    groove: draft.groove === 'auto' ? undefined : draft.groove,
    transpose: draft.transpose,
    tags: draft.tags,
    drone: draft.drone,
  }), [result, draft.id, draft.groove, draft.transpose, draft.tags, draft.drone]);

  const fitted = useMemo(() => fitSong(song, inst, r), [song, inst, r]);
  const hard = useMemo(() => hardNotes(fitted, inst, r), [fitted, inst, r]);
  const suggestion = useMemo(() => (hard > 0 ? bestTranspose(song, inst, r) : null), [song, inst, r, hard]);
  const hasNotes = song.notes.some((n) => n.midi !== null);

  // Auto-save songs that already live in My songs.
  useEffect(() => {
    if (saved !== 'dirty' || !hasNotes) return;
    const t = setTimeout(() => {
      mySongs.value = upsertSong(mySongs.value, song);
      setSaved('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [song, saved, hasNotes]);

  const update = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    if (saved !== 'new') setSaved('dirty');
  };

  const save = () => {
    if (!hasNotes) {
      showToast('Add some notes first.');
      return;
    }
    mySongs.value = upsertSong(mySongs.value, song);
    setSaved('saved');
  };

  const jumpToLine = (line: number) => {
    const el = ta.current;
    if (!el || line < 1) return;
    const lines = draft.text.split('\n');
    const start = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, (line - 4) * lh);
  };

  const field = (key: string, value: string) => update({ text: setDirective(draft.text, format, key, value) });

  return (
    <Modal
      wide
      title={<>{saved === 'new' ? 'New song' : 'Edit'}: {song.title}</>}
      onClose={() => (panel.value = null)}
      actions={
        <>
          <button class="ghost-btn small" onClick={() => { songsTab.value = 'mine'; panel.value = 'songs'; }}><IconBack size={14} /> My songs</button>
          <button class="ghost-btn small" disabled={!hasNotes} onClick={() => { if (saved !== 'saved') save(); playAlong(song); }}><IconPlay size={12} /> Play</button>
          {saved === 'saved' ? <span class="saved-pill">Saved</span> : <button class="primary-btn small" onClick={save}>{initial.fromBuiltin ? 'Save a copy' : 'Save'}</button>}
        </>
      }
    >
      <div class="editor-fields">
        <label class="f-title">
          <span>Title</span>
          <input type="text" value={song.title} onChange={(e) => field('title', (e.target as HTMLInputElement).value)} />
        </label>
        <label>
          <span>Notation</span>
          <select value={draft.format} onChange={(e) => update({ format: (e.target as HTMLSelectElement).value as FormatChoice })}>
            <option value="auto">Auto ({formatName(detectTextFormat(draft.text))})</option>
            <option value="letters">Letters (C D E)</option>
            <option value="sargam">Sargam (Sa Re Ga)</option>
            <option value="abc">ABC notation</option>
          </select>
        </label>
        <label>
          <span>{format === 'sargam' ? 'Written for' : 'Key'}</span>
          <div class="input-with-btns">
            {format === 'sargam' ? (
              // Sargam is relative: this says which bansuri the notation was written on (its Sa).
              <select value={song.sa ?? 60} title="The flute (Sa) the notation was written for" onChange={(e) => field('sa', noteName(Number((e.target as HTMLSelectElement).value)))}>
                {[...new Set([...SA_CHOICES, song.sa ?? 60])].sort((a, b) => a - b).map((m) => (
                  <option value={m}>{noteName(m, { octave: false })} flute · Sa {noteName(m)}</option>
                ))}
              </select>
            ) : (
              <span class="static-field">{keyLabel(song.tonic, song.mode)}</span>
            )}
            <button class="icon-btn tiny" title="Transpose down a semitone" disabled={draft.transpose <= -12} onClick={() => update({ transpose: Math.max(-12, draft.transpose - 1) })}>−</button>
            <button class="icon-btn tiny" title="Transpose up a semitone" disabled={draft.transpose >= 12} onClick={() => update({ transpose: Math.min(12, draft.transpose + 1) })}>+</button>
            {draft.transpose !== 0 && (
              <button class="link small-text" title="Reset transposition" onClick={() => update({ transpose: 0 })}>
                {draft.transpose > 0 ? '+' : ''}{draft.transpose} ×
              </button>
            )}
          </div>
        </label>
        <label class="f-num">
          <span>Tempo</span>
          <input type="number" min={20} max={300} value={Math.round(song.bpm)} onChange={(e) => field('tempo', (e.target as HTMLInputElement).value)} />
        </label>
        <label class="f-num">
          <span>Time</span>
          <select value={`${song.time[0]}/${song.time[1]}`} onChange={(e) => field('time', (e.target as HTMLSelectElement).value)}>
            {['2/4', '3/4', '4/4', '6/8', '7/8', '9/8', '12/8', '2/2'].map((t) => <option value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span>Rhythm</span>
          <select value={draft.groove} onChange={(e) => update({ groove: (e.target as HTMLSelectElement).value })}>
            <option value="auto">Auto (from time)</option>
            <option value="none">No drums</option>
            {(['Western', 'Folk', 'Indian'] as const).map((g) => (
              <optgroup label={g}>
                {GROOVES.filter((x) => x.group === g).map((x) => <option value={x.id}>{x.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div class="editor-split">
        <div class="editor-left">
          <div class="pane-head">
            <b>Notes</b>
            <button class="link" onClick={() => setShowHelp(!showHelp)}>{showHelp ? 'Hide help' : 'How to write'}</button>
          </div>
          {showHelp && <HowToWrite />}
          <textarea
            ref={ta}
            class="song-text"
            spellcheck={false}
            value={draft.text}
            onInput={(e) => update({ text: (e.target as HTMLTextAreaElement).value })}
            placeholder="Paste notes, Sargam, ABC, or a lyrics sheet with notes…"
          />
          {result.warnings.length > 0 && (
            <div class="warnings">
              {result.warnings.slice(0, 4).map((w) => (
                <div class={'warning' + (w.info ? ' info' : '')}>
                  {w.line > 0 && <button class="link" onClick={() => jumpToLine(w.line)}>Line {w.line}</button>}
                  <span>{w.message}</span>
                </div>
              ))}
              {result.warnings.length > 4 && <div class="warning muted">and {result.warnings.length - 4} more</div>}
            </div>
          )}
        </div>
        <div class="editor-right">
          <div class="pane-head">
            <b>Preview</b>
            <span class="preview-meta">
              {format === 'sargam' ? 'Sargam' : keyLabel(song.tonic, song.mode)} / {Math.round(song.bpm)} BPM / {song.time[0]}/{song.time[1]}
            </span>
          </div>
          <Preview song={fitted} hard={hard} suggestion={suggestion} onTranspose={(t) => update({ transpose: t })} writtenSa={format === 'sargam' ? song.sa : undefined} />
        </div>
      </div>
    </Modal>
  );
}

function formatName(f: TextFormat) {
  return f === 'abc' ? 'ABC' : f === 'sargam' ? 'Sargam' : 'Letters';
}

function Preview({ song, hard, suggestion, onTranspose, writtenSa }: { song: Song; hard: number; suggestion: { semis: number; hard: number } | null; onTranspose: (t: number) => void; writtenSa?: number }) {
  const inst = instrument.value;
  const r = root.value;
  const otherFlute = writtenSa !== undefined && inst.id === 'bansuri' && writtenSa !== r ? inst.keyOptions.find((k) => k.root === writtenSa) : undefined;
  const distinct = useMemo(() => {
    const set = new Set<number>();
    for (const n of song.notes) if (n.midi !== null) set.add(n.midi);
    return [...set].sort((a, b) => a - b);
  }, [song]);
  const range = pitchRange(song);
  const [lo, hi] = inst.range(r);

  if (!distinct.length) return <div class="empty-note">Notes you write show up here with their fingerings.</div>;

  const sections = song.sections.length ? [...song.sections].sort((a, b) => a.start - b.start) : [{ name: 'Song', start: 0 }];
  const bars = notesByBar(song);
  const bl = barLength(song.time);

  return (
    <div class="preview">
      <div class="fit-line">
        <span>
          {inst.name} · range {label(lo)}–{label(hi)} · song {range ? `${label(range[0])}–${label(range[1])}` : ''}
        </span>
        {hard > 0 ? (
          <span class="warn-text">
            {hard} note{hard > 1 ? 's' : ''} without a fingering.
            {suggestion && suggestion.hard < hard && (
              <> <button class="link gold" onClick={() => onTranspose((song.transpose ?? 0) + suggestion.semis)}>
                Transpose {suggestion.semis > 0 ? '+' : ''}{suggestion.semis} ({suggestion.hard === 0 ? 'all playable' : `${suggestion.hard} left`})
              </button></>
            )}
          </span>
        ) : (
          <span class="ok-text">Every note is playable.</span>
        )}
        {otherFlute && (
          <span class="muted">
            Written for a {noteName(writtenSa!, { octave: false })} bansuri; it plays on your {noteName(r, { octave: false })} bansuri with the same fingerings, {Math.abs(r - writtenSa!)} semitone{Math.abs(r - writtenSa!) === 1 ? '' : 's'} {r > writtenSa! ? 'higher' : 'lower'}.{' '}
            <button class="link gold" onClick={() => setPrefs({ keys: { ...prefs.value.keys, bansuri: writtenSa }, fluteCents: { ...prefs.value.fluteCents, bansuri: 0 } })}>
              Switch to a {noteName(writtenSa!, { octave: false })} flute
            </button>
          </span>
        )}
      </div>

      <div class="section-label">Notes you need</div>
      <div class="fingering-strip">
        {distinct.map((m) => {
          const f = inst.fingering(m, r);
          return (
            <div class={'fs-item' + (f ? '' : ' bad')}>
              <FingeringDiagram inst={inst} fingering={f} size={0.85} />
              <b>{label(m)}</b>
            </div>
          );
        })}
      </div>

      {sections.map((sec, si) => {
        const end = sections[si + 1]?.start ?? Infinity;
        const firstBar = Math.floor(sec.start / bl + 1e-6);
        const lastBar = Math.min(bars.length, Math.ceil(Math.min(end, bars.length * bl) / bl - 1e-6));
        const slice = bars.slice(firstBar, lastBar);
        if (!slice.length) return null;
        return (
          <div>
            <div class="section-label">{sec.name}</div>
            <div class="bar-grid">
              {slice.map((notes) => (
                <div class="bar-cell">
                  {notes.length ? notes.map((n) => (
                    <span class={'bn' + (n.midi === null ? ' rest' : inst.fingering(n.midi, r) ? '' : ' bad')} style={{ flexGrow: n.dur }}>
                      {n.midi === null ? '·' : label(n.midi, { octave: false })}
                    </span>
                  )) : <span class="bn rest">–</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HowToWrite() {
  return (
    <div class="help-box">
      <p><b>Letters:</b> <code>C D E F G A B</code>, sharps <code>F#</code>, flats <code>Bb</code>. Octave number <code>C5</code>, or <code>'</code> for one octave up (<code>C'</code>).</p>
      <p><b>Sargam:</b> <code>Sa Re Ga Ma Pa Dha Ni</code> or <code>S R G M P D N</code>. Komal <code>Rek</code> / <code>Re(k)</code>, or lowercase <code>r g d n</code>. Tivra <code>Ma#</code>. Lower octave <code>.Ni</code>, upper <code>Sa'</code>.</p>
      <p><b>Rhythm:</b> each note is one beat. <code>G--</code> holds for 3 beats, <code>C/</code> is half a beat, <code>(C D)</code> fits two notes in one beat, <code>_</code> is a rest, <code>|</code> marks a bar. <code>Unit: 1/8</code> makes each note an eighth instead.</p>
      <p><b>Details:</b> <code>Title:</code> <code>Tempo: 96</code> <code>Time: 3/4</code> <code>Key: D</code> <code>Sa: C#4</code>. Sections: <code>[Verse]</code>, <code>[Chorus]</code>, <code>Antara:</code>.</p>
      <p><b>Lyrics:</b> paste a sheet with words and notes on separate lines. Word lines are kept and shown while you play.</p>
      <p><b>ABC:</b> paste any tune from an ABC library (it needs <code>X:</code> and <code>K:</code> lines).</p>
    </div>
  );
}

/** Bansuri sizes the app offers (G3 to C5), by Sa. */
const SA_CHOICES = Array.from({ length: 18 }, (_, i) => 55 + i);

/** Rewrites (or inserts) a header line such as "Tempo: 90" in the song text. */
export function setDirective(text: string, format: TextFormat, key: string, value: string): string {
  if (format === 'abc') {
    const map: Record<string, [string, string]> = {
      title: ['T', value],
      tempo: ['Q', `1/4=${value}`],
      time: ['M', value],
    };
    const [f, v] = map[key] ?? [];
    if (!f) return text;
    const re = new RegExp(`^${f}:.*$`, 'm');
    if (re.test(text)) return text.replace(re, `${f}:${v}`);
    return text.replace(/^(X:.*\n)?/, (m) => `${m}${f}:${v}\n`);
  }
  if (key === 'sa') {
    // Update whichever line names the flute ("Sa: …" or "Flute used for notations: …"), else add one.
    const saLine = /^\s*sa\s*[:=].*$/im;
    const fluteLine = /^(\s*(?:flute|bansuri)\b[^:=\n]{0,40}[:=]\s*)[A-Ga-g].*$/im;
    if (saLine.test(text)) return text.replace(saLine, `Sa: ${value}`);
    if (fluteLine.test(text)) return text.replace(fluteLine, (_, head: string) => `${head}${value}`);
    return `Sa: ${value}\n${text}`;
  }
  const names: Record<string, string> = { title: 'Title', tempo: 'Tempo', time: 'Time', artist: 'Artist' };
  const name = names[key];
  const re = new RegExp(`^\\s*${name}\\s*[:=].*$`, 'im');
  if (re.test(text)) return text.replace(re, `${name}: ${value}`);
  return `${name}: ${value}\n${text}`;
}
