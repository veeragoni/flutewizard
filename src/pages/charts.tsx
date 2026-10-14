import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { INSTRUMENT_ORDER, INSTRUMENTS, rootFor, timbreFor, type InstrumentId } from '../instruments';
import { noteName, sargamName, SARGAM_LONG } from '../music/theory';
import { prefs, setPrefs } from '../state';
import { FingeringDiagram } from '../ui/FingeringDiagram';
import { InstrumentIcon } from '../ui/icons';
import { engine } from '../audio/engine';
import { HybridVoice, loadFluteModel } from '../audio/modelVoice';
import { PageShell } from './shell';
import '../styles.css';
import './pages.css';

/** Complete fingering chart for each flute, every note playable with a click. */
function Charts() {
  const q = new URLSearchParams(location.search).get('i') as InstrumentId | null;
  const [id, setId] = useState<InstrumentId>(q && INSTRUMENTS[q] ? q : prefs.value.instrument);
  const inst = INSTRUMENTS[id];
  const [root, setRoot] = useState(rootFor(inst, prefs.value.keys[id]));
  const r = rootFor(inst, root);
  const voice = useRef<HybridVoice | null>(null);

  const hear = (midi: number) => {
    engine.ensure();
    void loadFluteModel().catch(() => {});
    const t = timbreFor(inst, r);
    if (!voice.current) voice.current = new HybridVoice(t, engine.instrument.input);
    else voice.current.setTimbre(t);
    voice.current.play(midi, engine.now + 0.03, 0.9);
  };

  const notes = inst.notes(r);
  return (
    <PageShell
      title={`${inst.name} fingering chart`}
      intro={`Every note on the ${inst.name.toLowerCase()} with its standard fingering${inst.id === 'bansuri' ? ', in Sargam and Western names' : ''}. Filled holes or keys are covered/pressed, half-filled are half-holed. Click a note to hear it.`}
    >
      <div class="tuner-pick">
        {INSTRUMENT_ORDER.map((x) => (
          <button class={'pick inst' + (x === id ? ' on' : '')} onClick={() => { setId(x); setRoot(rootFor(INSTRUMENTS[x], prefs.value.keys[x])); history.replaceState(null, '', `?i=${x}`); }}>
            <InstrumentIcon id={x} size={70} />
            <span>{INSTRUMENTS[x].short}</span>
          </button>
        ))}
      </div>
      {inst.keyOptions.length > 1 && (
        <label class="field-row" style={{ maxWidth: '360px', margin: '0 0 16px' }}>
          <span>{inst.id === 'bansuri' ? 'Flute key (Sa)' : 'Whistle key'}</span>
          <select value={r} onChange={(e) => { const v = Number((e.target as HTMLSelectElement).value); setRoot(v); setPrefs({ keys: { ...prefs.value.keys, [id]: v } }); }}>
            {inst.keyOptions.map((k) => <option value={k.root}>{k.label}</option>)}
          </select>
        </label>
      )}
      <div class="chart-grid">
        {notes.map((m) => {
          const f = inst.fingering(m, r)!;
          const reg = f.kind === 'holes' ? f.f.register : null;
          return (
            <button class="chart-cell" onClick={() => hear(m)} title="Click to hear">
              <FingeringDiagram inst={inst} fingering={f} size={1.1} />
              <b>{inst.id === 'bansuri' ? sargamName(m, r) : noteName(m)}</b>
              <small>{inst.id === 'bansuri' ? `${noteName(m)} · ${SARGAM_LONG[((m - r) % 12 + 12) % 12]}` : f.f.hint ?? ''}</small>
              {reg && reg > 1 && <small class="gold">{reg === 2 ? 'overblow' : '3rd register'}</small>}
              {f.alternates.length > 0 && (
                <div class="alts">
                  {f.alternates.map((a) => (
                    <span title={a.hint}>
                      <FingeringDiagram inst={inst} fingering={{ ...f, f: a } as typeof f} size={0.55} />
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <section class="article">
        <h2>Reading the chart</h2>
        <p>The mouthpiece is at the top. {inst.hasThumbHole ? 'The small hole to the left is the thumb hole on the back. ' : ''}{inst.id === 'concert' ? 'The large circles are the six main keys (left hand on top, right hand below). Small keys at the side are the thumb keys, the G♯ key, trill keys, the E♭ key and the foot-joint rollers.' : 'Holes are grouped by hand: top hand above the gap, bottom hand below.'} A + next to the diagram means overblow (faster air) for the second register.</p>
        <p>Sources: the Woodwind Fingering Guide, Yamaha and Dolmetsch charts, Grey Larsen&rsquo;s whistle chart and bansuri teachers&rsquo; charts. See <a href="/credits/">credits</a>.</p>
      </section>
    </PageShell>
  );
}

render(<Charts />, document.getElementById('app')!);
