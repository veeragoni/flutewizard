import { useEffect, useRef, useState } from 'preact/hooks';
import { instrument, panel, prefs, root, setPrefs, showToast, timbre } from '../state';
import { bumpCustom, customNotes, NoteTaker, type CustomNote, type TakeResult } from '../audio/customSamples';
import { engine } from '../audio/engine';
import { transport } from '../audio/transport';
import { ensureAudio } from '../play';
import { FingeringDiagram } from './FingeringDiagram';
import { label, subLabel } from './names';
import { Modal } from './Modal';
import { IconHeadphones, IconMic, IconPlay, IconStop, IconTrash } from './icons';

/**
 * Guided recording of your own flute, note by note. The app keeps the steady part of each take,
 * checks it's the right note, and builds a playable instrument from your recordings.
 */
export function RecordOwn() {
  const inst = instrument.value;
  const r = root.value;
  const setId = `${inst.id}:${r}`;
  const notes = inst.notes(r);
  const [have, setHave] = useState<Map<number, CustomNote>>(new Map());
  const [active, setActive] = useState<number | null>(null);
  const [result, setResult] = useState<{ midi: number; res: TakeResult } | null>(null);
  const [level, setLevel] = useState(0);
  const taker = useRef<NoteTaker | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const reload = () => void customNotes.list(setId).then((l) => setHave(new Map(l.map((n) => [n.midi, n]))));
  useEffect(reload, [setId]);
  useEffect(() => () => taker.current?.cancel(), []);
  useEffect(() => {
    if (active === null) return;
    const t = setInterval(() => setLevel(taker.current?.level ?? 0), 60);
    return () => clearInterval(t);
  }, [active]);

  const start = async (midi: number) => {
    ensureAudio();
    if (active !== null) return;
    setResult(null);
    const t = new NoteTaker();
    taker.current = t;
    try {
      await t.start(6, () => finish(midi));
      setActive(midi);
    } catch {
      showToast('Microphone access was blocked. Allow the microphone to record your flute.');
    }
  };

  const finish = async (midi: number) => {
    const t = taker.current;
    if (!t) return;
    taker.current = null;
    setActive(null);
    const res = t.stop(midi);
    setResult({ midi, res });
    if (res.ok && res.wav) {
      await customNotes.save({ key: `${setId}|${midi}`, setId, midi, cents: res.cents, seconds: res.seconds, wav: res.wav, created: Date.now() });
      reload();
      bumpCustom();
    }
  };

  const listen = (n: CustomNote) => {
    audio.current?.pause();
    const a = new Audio(URL.createObjectURL(n.wav));
    audio.current = a;
    void a.play();
  };

  const reference = (midi: number) => {
    ensureAudio();
    transport.ensureVoice(timbre.value);
    transport.preview(midi, 1.2);
  };

  const count = notes.filter((m) => have.has(m)).length;
  const core = notes.filter((m) => [0, 2, 4, 5, 7, 9, 11, 12].includes(m - r) || inst.id !== 'bansuri');

  return (
    <Modal title={`Record your own ${inst.name.toLowerCase()}`} onClose={() => (panel.value = null)} wide
      actions={
        <label class="toggle">
          Use my recordings
          <input type="checkbox" checked={prefs.value.sound === 'mine'} disabled={!count}
            onChange={(e) => setPrefs({ sound: (e.target as HTMLInputElement).checked ? 'mine' : 'recorded' })} />
          <span class="switch" />
        </label>
      }
    >
      <div class="own-intro">
        <div>
          <p><b>{count}</b> of {notes.length} notes recorded{inst.keyOptions.length > 1 ? ` for your ${inst.keyOptions.find((k) => k.root === r)?.label}` : ''}. Notes you skip are filled in from the nearest recording.</p>
          <ul class="help-list">
            <li>Quiet room, flute about 30 cm from the microphone. Turn off noise suppression if your device has it.</li>
            <li>Press <b>Record</b>, then play the note steadily for 2–3 seconds with your normal tone. It stops by itself.</li>
            <li>Start with {inst.id === 'bansuri' ? 'Sa Re Ga Ma Pa Dha Ni Sa’' : 'one octave of the scale'}; add the rest later. Recordings stay in this browser.</li>
          </ul>
        </div>
        {active !== null && (
          <div class="own-live">
            <span class="mic-dot on" /> Recording <b>{label(active)}</b>…
            <div class="level"><div style={{ width: `${Math.min(100, level * 500)}%` }} /></div>
            <button class="primary-btn small" onClick={() => void finish(active)}><IconStop size={14} /> Stop</button>
          </div>
        )}
        {result && active === null && (
          <div class={'own-result ' + (result.res.ok ? 'ok' : 'bad')}>
            <b>{label(result.midi)}:</b> {result.res.message}
          </div>
        )}
      </div>
      <div class="own-grid">
        {notes.map((m) => {
          const n = have.get(m);
          const isCore = core.includes(m);
          return (
            <div class={'own-cell' + (n ? ' done' : '') + (active === m ? ' live' : '') + (isCore && !n ? ' core' : '')}>
              <FingeringDiagram inst={inst} fingering={inst.fingering(m, r)} size={0.8} />
              <b>{label(m)}</b>
              <small>{subLabel(m)}</small>
              <small class={n ? (Math.abs(n.cents) < 15 ? 'ok-text' : 'gold') : 'muted'}>
                {n ? `✓ ${n.cents >= 0 ? '+' : ''}${n.cents.toFixed(0)}¢ · ${n.seconds.toFixed(1)}s` : isCore ? 'start here' : '—'}
              </small>
              <div class="own-btns">
                <button class="icon-btn tiny" title="Hear the target note" onClick={() => reference(m)}><IconHeadphones size={13} /></button>
                {active === m
                  ? <button class="primary-btn small" onClick={() => void finish(m)}><IconStop size={12} /></button>
                  : <button class="ghost-btn small" disabled={active !== null} onClick={() => void start(m)}><IconMic size={12} /> {n ? 'Redo' : 'Record'}</button>}
                {n && <button class="icon-btn tiny" title="Play my take" onClick={() => listen(n)}><IconPlay size={11} /></button>}
                {n && (
                  <button class="icon-btn tiny" title="Delete" onClick={() => void customNotes.remove(setId, m).then(() => { reload(); bumpCustom(); })}>
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p class="muted small-note">Sample rate {engine.ctx ? engine.ctx.sampleRate : 48000} Hz. Takes are trimmed to the steady part and levelled; pitch is corrected on playback.</p>
    </Modal>
  );
}
