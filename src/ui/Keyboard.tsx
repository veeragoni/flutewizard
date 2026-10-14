import { instrument, octaveShift, prefs, range, root, setPrefs, shownNote } from '../state';
import { CONCERT_KEYS, holeKeys, keyLabel, noteForKey, pressNote, pressedCodes, releaseNote, SCALE_ROWS } from '../play';
import { label } from './names';

/** On-screen keyboard: shows what every computer key does, and can be played with mouse/touch. */
export function Keyboard() {
  const p = prefs.value;
  return (
    <section class="kbd-panel">
      <div class="kbd-head">
        {p.inputMode === 'keyboard' ? (
          <>
            <div class="seg">
              <button class={p.layout === 'scale' ? 'on' : ''} onClick={() => setPrefs({ layout: 'scale' })}>Scale</button>
              <button class={p.layout === 'chromatic' ? 'on' : ''} onClick={() => setPrefs({ layout: 'chromatic' })}>Chromatic</button>
            </div>
            <span class="kbd-tip">
              {p.layout === 'scale'
                ? <>Rows are octaves. <kbd>Shift</kbd> {instrument.value.naming === 'sargam' ? 'for komal / tivra' : 'for sharp'} · <kbd>Space</kbd> vibrato · <kbd>←</kbd><kbd>→</kbd> bend · <kbd>↑</kbd><kbd>↓</kbd> octave ({octaveShift.value >= 0 ? '+' : ''}{octaveShift.value})</>
                : <>Piano layout: letters are white keys, the row above is black keys · <kbd>↑</kbd><kbd>↓</kbd> octave ({octaveShift.value >= 0 ? '+' : ''}{octaveShift.value})</>}
            </span>
          </>
        ) : (
          <span class="kbd-tip">
            Fingers: home row covers holes, the row above half-covers · hold <kbd>Space</kbd> to blow · <kbd>Shift</kbd> / <kbd>H</kbd> overblow
          </span>
        )}
        <button class="link" onClick={() => setPrefs({ showKeyboard: false })}>Hide</button>
      </div>
      {p.inputMode === 'keyboard' ? (p.layout === 'scale' ? <ScaleKeys /> : <ChromaticKeys />) : <FingerKeys />}
    </section>
  );
}

function KeyCap({ code, midi, extra }: { code: string; midi: number | null; extra?: string }) {
  const [lo, hi] = range.value;
  const playable = midi !== null && midi >= lo && midi <= hi;
  const down = pressedCodes.value.has(code);
  const id = 'touch:' + code;
  return (
    <button
      class={'kcap' + (down ? ' down' : '') + (playable ? '' : ' off') + (extra ? ' ' + extra : '')}
      onPointerDown={(e) => {
        if (midi === null || !playable) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pressNote(id, midi);
      }}
      onPointerUp={() => releaseNote(id)}
      onPointerCancel={() => releaseNote(id)}
      onPointerEnter={() => playable && (shownNote.value = midi)}
      onPointerLeave={() => (shownNote.value = null)}
      tabIndex={-1}
    >
      <span class="kc-key">{keyLabel(code)}</span>
      <span class="kc-note">{midi !== null ? label(midi, { octave: false }) : ''}</span>
    </button>
  );
}

function ScaleKeys() {
  void octaveShift.value;
  void root.value;
  return (
    <div class="kbd-rows">
      {SCALE_ROWS.map((row, r) => (
        <div class="kbd-row" style={{ paddingLeft: `${r * 18}px` }}>
          {row.map((code) => <KeyCap code={code} midi={noteForKey(code)} />)}
        </div>
      ))}
    </div>
  );
}

const CHROMA_TOP = ['Digit2', 'Digit3', '', 'Digit5', 'Digit6', 'Digit7', '', 'Digit9', 'Digit0', '', 'Equal'];
const CHROMA_TOP_W = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'];
const CHROMA_LOW = ['KeyS', 'KeyD', '', 'KeyG', 'KeyH', 'KeyJ', '', 'KeyL', 'Semicolon'];
const CHROMA_LOW_W = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'];

function ChromaticKeys() {
  void octaveShift.value;
  const row = (codes: string[], black: boolean) => (
    <div class={'kbd-row' + (black ? ' black' : '')}>
      {codes.map((c) => (c ? <KeyCap code={c} midi={noteForKey(c)} extra={black ? 'black' : ''} /> : <span class="kcap gap" />))}
    </div>
  );
  return (
    <div class="kbd-rows chroma">
      {row(CHROMA_TOP, true)}
      {row(CHROMA_TOP_W, false)}
      {row(CHROMA_LOW, true)}
      {row(CHROMA_LOW_W, false)}
    </div>
  );
}

function FingerKeys() {
  const inst = instrument.value;
  const down = pressedCodes.value;
  if (inst.id === 'concert') {
    return (
      <div class="kbd-rows">
        <div class="kbd-row">
          {Object.entries(CONCERT_KEYS).map(([code, k]) => (
            <span class={'kcap' + (down.has(code) ? ' down' : '')}>
              <span class="kc-key">{keyLabel(code)}</span>
              <span class="kc-note">{k}</span>
            </span>
          ))}
          <span class={'kcap wide' + (down.has('Space') ? ' down' : '')}><span class="kc-key">Space</span><span class="kc-note">blow</span></span>
        </div>
      </div>
    );
  }
  const { full, half } = holeKeys();
  const names = inst.id === 'recorder' ? ['thumb', '1', '2', '3', '4', '5', '6', '7'] : ['1', '2', '3', '4', '5', '6'];
  return (
    <div class="kbd-rows">
      <div class="kbd-row">
        {half.map((code, i) => (
          <span class={'kcap' + (down.has(code) ? ' down' : '')}>
            <span class="kc-key">{keyLabel(code)}</span>
            <span class="kc-note">½ {names[i]}</span>
          </span>
        ))}
      </div>
      <div class="kbd-row">
        {full.map((code, i) => (
          <span class={'kcap' + (down.has(code) ? ' down' : '')}>
            <span class="kc-key">{keyLabel(code)}</span>
            <span class="kc-note">hole {names[i]}</span>
          </span>
        ))}
      </div>
      <div class="kbd-row">
        <span class={'kcap' + (down.has('ShiftLeft') ? ' down' : '')}><span class="kc-key">Shift</span><span class="kc-note">overblow</span></span>
        <span class={'kcap wide' + (down.has('Space') ? ' down' : '')}><span class="kc-key">Space</span><span class="kc-note">blow</span></span>
      </div>
    </div>
  );
}
