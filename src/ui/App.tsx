import { useEffect } from 'preact/hooks';
import { activeNote, instrument, panel, prefs, root, setPrefs, songKeys, toast, currentSong, heldHoles, heldKeys, shownNote } from '../state';
import { INSTRUMENT_ORDER, INSTRUMENTS, noteFromFingers, type InstrumentId } from '../instruments';
import { FluteView } from './FluteView';
import { closeKeyFinder, ensureAudio, findMyKey, micProblem, resumeMic, startMic, fingerPreview, homeNoteHint, installKeyboard, keyFinder, micOn, micReading, setBlow, setFinger, setInputMode, CONCERT_KEYS, holeKeys, setOverblow } from '../play';
import { noteName } from '../music/theory';
import { IconHand, IconKeyboard, IconMenu, IconMic, InstrumentIcon } from './icons';
import { label, subLabel } from './names';
import { Keyboard } from './Keyboard';
import { TransportBar } from './TransportBar';
import { NoteLane } from './NoteLane';
import { installSearchShortcut, SongsPanel } from './SongsPanel';
import { Editor } from './Editor';
import { RecordOwn } from './RecordOwn';
import { SideRail, SidePanels } from './SidePanels';
import { MainMenu } from './MainMenu';
import { Logo } from './Logo';
import { track } from '../analytics';
import { at } from '../base';
import { transportState } from '../audio/transport';
import type { ConcertKey } from '../instruments/types';

export function App() {
  useEffect(() => { installKeyboard(); installSearchShortcut(); resumeMic(); }, []);
  const p = prefs.value;

  return (
    <div class="app" onPointerDown={() => ensureAudio()}>
      <TopBar />
      <TransportBar />
      <main class="stage">
        <SideRail />
        <Stage />
        {currentSong.value && <NoteLane />}
      </main>
      {p.showKeyboard && p.inputMode !== 'mic' && <Keyboard />}
      {p.inputMode === 'mic' && <MicStatus />}
      {panel.value === 'songs' && <SongsPanel />}
      {panel.value === 'editor' && <Editor />}
      {panel.value === 'own' && <RecordOwn />}
      <SidePanels />
      <MainMenu />
      {toast.value && <div class="toast" role="status">{toast.value}</div>}
    </div>
  );
}

function TopBar() {
  const p = prefs.value;
  const pick = (id: InstrumentId) => {
    setPrefs({ instrument: id });
    track(`flute/${id}`);
  };
  return (
    <header class="topbar">
      <a class="brand" href={at('')}>
        <Logo />
        <span>
          <b>Flute Wizard</b>
          <small>Online Virtual Flute</small>
        </span>
      </a>
      <div class="pickers">
        <div class="picker">
          <span class="picker-title">Play mode</span>
          <div class="picker-row">
            <button class={'pick' + (p.inputMode === 'keyboard' ? ' on' : '')} onClick={() => setInputMode('keyboard')} title="Play notes from the computer keyboard">
              <IconKeyboard size={22} /><span>Keyboard</span>
            </button>
            <button class={'pick' + (p.inputMode === 'fingers' ? ' on' : '')} onClick={() => setInputMode('fingers')} title="Cover the holes with your fingers on the keyboard or screen">
              <IconHand size={22} /><span>Fingers</span>
            </button>
            <button class={'pick' + (p.inputMode === 'mic' ? ' on' : '')} onClick={() => setInputMode('mic')} title="Play your real flute into the microphone">
              <IconMic size={22} /><span>My flute</span>
            </button>
          </div>
        </div>
        <div class="picker">
          <span class="picker-title">Pick a flute</span>
          <div class="picker-row">
            {INSTRUMENT_ORDER.map((id) => (
              <button class={'pick inst' + (p.instrument === id ? ' on' : '')} onClick={() => pick(id)} title={INSTRUMENTS[id].blurb}>
                <InstrumentIcon id={id} size={70} />
                <span>{INSTRUMENTS[id].short}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <button class="icon-btn menu-btn" onClick={() => (panel.value = panel.value === 'help' ? null : 'help')} aria-label="Menu">
        <IconMenu />
      </button>
    </header>
  );
}

function Stage() {
  const inst = instrument.value;
  const p = prefs.value;
  const r = root.value;
  const song = currentSong.value;
  const idx = transportState.noteIndex.value;
  const songNote = song && idx >= 0 ? song.notes[idx]?.midi ?? null : null;
  const fingersMode = p.inputMode === 'fingers';
  const held = fingersMode ? (inst.id === 'concert' ? { keys: heldKeys.value } : { holes: heldHoles.value }) : null;

  // What to show: the note being played, else the song's current note, else a hovered key.
  const shown = activeNote.value ?? (fingersMode ? fingerPreview.value : null) ?? songNote ?? shownNote.value;
  const fingering = shown !== null ? inst.fingering(shown, r) : null;
  const sounding = activeNote.value !== null;

  const onHole = (i: number, state: 0 | 0.5 | 1) => {
    const { full, half } = holeKeys();
    setFinger(full[i], state === 1);
    setFinger(half[i], state === 0.5);
  };
  const onKey = (k: ConcertKey, down: boolean) => {
    const code = Object.entries(CONCERT_KEYS).find(([, v]) => v === k)?.[0];
    if (code) setFinger(code, down);
  };

  const wantFingering = songNote !== null && fingersMode ? inst.fingering(songNote, r) : null;
  const fingersMatch = fingersMode && songNote !== null && held
    ? noteFromFingers(inst, r, held, 0)?.midi === songNote || noteFromFingers(inst, r, held, 1)?.midi === songNote || noteFromFingers(inst, r, held, 2)?.midi === songNote
    : null;

  return (
    <section class="flute-stage">
      <div class="note-readout" aria-live="polite">
        {shown !== null ? (
          <>
            <div class={'note-big' + (sounding ? ' live' : '')}>{label(shown)}</div>
            <div class="note-sub">{subLabel(shown)}</div>
            {fingering?.f.hint && <div class="note-hint">{fingering.f.hint}</div>}
            {fingering?.kind === 'holes' && fingering.f.register > 1 && (
              <div class="note-hint">{fingering.f.register === 2 ? 'Overblow: blow a little faster' : 'Third register: fast, focused air'}</div>
            )}
            {!fingering && <div class="note-hint warn">Not playable on this flute</div>}
          </>
        ) : (
          <div class="note-idle">
            {p.inputMode === 'keyboard' && 'Press a key to play'}
            {p.inputMode === 'fingers' && 'Cover holes, then hold Space to blow'}
            {p.inputMode === 'mic' && 'Play your flute: I’m listening'}
          </div>
        )}
      </div>
      <div class="flute-wrap">
        <FluteView
          inst={inst}
          fingering={fingering}
          held={held && (held.holes?.length || held.keys?.length) ? held : null}
          interactive={fingersMode}
          onHole={onHole}
          onKey={onKey}
          sounding={sounding}
        />
        {wantFingering && fingersMatch === false && (
          <div class="ghost-target">
            Next: <b>{label(songNote!)}</b>
          </div>
        )}
      </div>
      {fingersMode && <BlowControls />}
      <KeySelect />
    </section>
  );
}

function BlowControls() {
  return (
    <div class="blow-row">
      <button
        class="blow-btn"
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setBlow(true); }}
        onPointerUp={() => setBlow(false)}
        onPointerCancel={() => setBlow(false)}
      >
        Hold to blow <kbd>Space</kbd>
      </button>
      <button
        class="blow-btn soft"
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setOverblow(1); }}
        onPointerUp={() => setOverblow(0)}
        onPointerCancel={() => setOverblow(0)}
      >
        Overblow <kbd>Shift</kbd>
      </button>
      <span class="blow-tip">Home row covers a hole, the row above half-covers it. Tap holes on the flute to cover them.</span>
    </div>
  );
}

function KeySelect() {
  const inst = instrument.value;
  if (inst.keyOptions.length < 2) return <div class="key-select"><span>{inst.keyOptions[0].label}</span></div>;
  return (
    <label class="key-select">
      <span>{inst.id === 'bansuri' ? 'Flute key (Sa)' : 'Whistle key'}</span>
      <select
        value={root.value}
        // Picking a key by hand forgets the tuning "Find my Sa" measured on the previous flute.
        onChange={(e) => { songKeys.value = null; setPrefs({ keys: { ...prefs.value.keys, [inst.id]: Number((e.target as HTMLSelectElement).value) }, fluteCents: { ...prefs.value.fluteCents, [inst.id]: 0 } }); }}
      >
        {inst.keyOptions.map((k) => <option value={k.root}>{k.label}</option>)}
      </select>
      <button class="link small-text" onClick={(e) => { e.preventDefault(); findMyKey(); }} title="Play your flute's home note and the app sets the key">
        {inst.id === 'bansuri' ? 'Find my Sa' : 'Find my key'}
      </button>
    </label>
  );
}

function MicStatus() {
  const r = micReading.value;
  const inst = instrument.value;
  const kf = keyFinder.value;
  const canFind = inst.keyOptions.length > 1;
  const findLabel = inst.id === 'bansuri' ? 'Find my Sa' : 'Find my key';
  if (kf) {
    return (
      <div class={'mic-status key-finder' + (kf.done ? (kf.ok ? ' ok' : ' bad') : '')}>
        <span class={'mic-dot' + (micOn.value ? ' on' : '')} />
        {!kf.done ? (
          <>
            <span>Play the {homeNoteHint()} and hold it steady…</span>
            {kf.heard !== null && <span class="muted">hearing {noteName(Math.round(kf.heard))}</span>}
            <div class="level"><div style={{ width: `${Math.round(kf.progress * 100)}%` }} /></div>
          </>
        ) : (
          <span>{kf.message}</span>
        )}
        <span class="spacer" />
        {kf.done && !kf.ok && <button class="ghost-btn small" onClick={findMyKey}>Try again</button>}
        <button class="ghost-btn small" onClick={closeKeyFinder}>{kf.done ? 'Done' : 'Cancel'}</button>
      </div>
    );
  }
  return (
    <div class="mic-status">
      <span class={'mic-dot' + (micOn.value ? ' on' : '')} />
      {micOn.value && micProblem.value === 'paused' ? (
        <span>Click anywhere (or press a key) to start listening.</span>
      ) : micOn.value ? (
        r.midi !== null ? (
          <span>
            Hearing <b>{label(r.midi)}</b> {r.cents >= 0 ? '+' : ''}{Math.round(r.cents)}¢
            {inst.naming === 'sargam' && <span class="muted"> · {noteName(r.midi)}{r.freq ? ` · ${Math.round(r.freq)} Hz` : ''}</span>}
          </span>
        ) : (
          <span>Listening… play a long note</span>
        )
      ) : micProblem.value === 'starting' ? (
        <span>Waiting for microphone permission… (allow it in the browser prompt)</span>
      ) : (
        <>
          <span>
            {micProblem.value === 'blocked'
              ? 'The microphone is blocked. Allow it from the icon in the address bar, then:'
              : micProblem.value === 'ended' ? 'The microphone disconnected.' : 'The microphone is off.'}
          </span>
          <button class="primary-btn small" onClick={() => void startMic()}>Start microphone</button>
        </>
      )}
      <div class="level"><div style={{ width: `${Math.min(100, r.level * 600)}%` }} /></div>
      {canFind && (
        <>
          <span class="spacer" />
          <span class="muted small-text">Wrong names? Your flute may be in another key.</span>
          <button class="ghost-btn small" onClick={findMyKey}>{findLabel}</button>
        </>
      )}
    </div>
  );
}
