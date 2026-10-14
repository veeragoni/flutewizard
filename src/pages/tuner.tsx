import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MicPitch } from '../audio/pitch';
import { engine } from '../audio/engine';
import { drone, DRONES, type DroneKind } from '../audio/drone';
import { INSTRUMENT_ORDER, INSTRUMENTS, rootFor, type InstrumentId } from '../instruments';
import { nearestNote, noteName, sargamName } from '../music/theory';
import { prefs, setPrefs } from '../state';
import { FingeringDiagram } from '../ui/FingeringDiagram';
import { InstrumentIcon } from '../ui/icons';
import { PageShell } from './shell';
import '../styles.css';
import './pages.css';

/** Microphone tuner for flutes, with the fingering of the note you're playing. */
function Tuner() {
  const initial = (new URLSearchParams(location.search).get('i') as InstrumentId) || prefs.value.instrument;
  const [instId, setInstId] = useState<InstrumentId>(INSTRUMENTS[initial] ? initial : 'concert');
  const inst = INSTRUMENTS[instId];
  const root = rootFor(inst, prefs.value.keys[instId]);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const [reading, setReading] = useState<{ midi: number; cents: number; freq: number } | null>(null);
  const [a4, setA4] = useState(prefs.value.a4);
  const [droneKind, setDroneKind] = useState<DroneKind>('tonic');
  const [droneOn, setDroneOn] = useState(false);
  const mic = useRef<MicPitch | null>(null);
  const smooth = useRef<{ cents: number; midi: number } | null>(null);
  const trace = useRef<number[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => () => { mic.current?.stop(); drone.stop(); }, []);
  useEffect(() => setPrefs({ a4 }), [a4]);

  const start = async () => {
    setErr('');
    engine.ensure();
    const m = new MicPitch();
    const [lo, hi] = inst.range(root);
    m.minFreq = (a4 * Math.pow(2, (lo - 3 - 69) / 12));
    m.maxFreq = (a4 * Math.pow(2, (hi + 3 - 69) / 12));
    try {
      await m.start((r) => {
        if (!r.freq || r.clarity < 0.82) {
          trace.current.push(NaN);
          if (trace.current.length > 240) trace.current.shift();
          return;
        }
        const n = nearestNote(r.freq, a4);
        const prev = smooth.current;
        const cents = prev && prev.midi === n.midi ? prev.cents * 0.75 + n.cents * 0.25 : n.cents;
        smooth.current = { midi: n.midi, cents };
        trace.current.push(cents);
        if (trace.current.length > 240) trace.current.shift();
        setReading({ midi: n.midi, cents, freq: r.freq });
      });
      mic.current = m;
      setOn(true);
    } catch {
      setErr('Microphone access was blocked. Allow the microphone for this site and try again.');
    }
  };
  const stop = () => {
    mic.current?.stop();
    mic.current = null;
    setOn(false);
  };

  // Draw the cents history trace.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        const W = (c.width = c.clientWidth * devicePixelRatio), H = (c.height = c.clientHeight * devicePixelRatio);
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
        ctx.fillStyle = 'rgba(95,211,154,0.08)';
        ctx.fillRect(0, H / 2 - (H / 2) * 0.1, W, H * 0.1);
        const hst = trace.current;
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.strokeStyle = '#f0b54d';
        ctx.beginPath();
        let pen = false;
        hst.forEach((v, i) => {
          const x = (i / 240) * W;
          if (isNaN(v)) { pen = false; return; }
          const y = H / 2 - (v / 50) * (H / 2);
          if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          pen = true;
        });
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cents = reading?.cents ?? 0;
  const inTune = reading && Math.abs(cents) < 5;
  const name = reading ? (inst.naming === 'sargam' ? sargamName(reading.midi, root) : noteName(reading.midi, { octave: false })) : '–';
  const sub = reading ? `${noteName(reading.midi)} · ${reading.freq.toFixed(1)} Hz` : on ? 'Play a long, steady note' : 'Press Start and allow the microphone';
  const fing = reading ? inst.fingering(reading.midi, root) : null;

  return (
    <PageShell
      title={`${inst.name} tuner`}
      intro={`Free online ${inst.name.toLowerCase()} tuner. Play a long note into your microphone: the needle shows how sharp or flat you are, and the chart shows the fingering for the note you're playing.`}
    >
      <div class="tuner-pick">
        {INSTRUMENT_ORDER.map((id) => (
          <button class={'pick inst' + (id === instId ? ' on' : '')} onClick={() => { stop(); setInstId(id); trace.current = []; setReading(null); history.replaceState(null, '', `?i=${id}`); }}>
            <InstrumentIcon id={id} size={70} />
            <span>{INSTRUMENTS[id].short}</span>
          </button>
        ))}
      </div>
      <div class="tuner-card">
        <div class="tuner-main">
          <div class={'tuner-note' + (inTune ? ' ok' : '')}>{name}</div>
          <div class="muted">{sub}</div>
          <Gauge cents={reading ? cents : null} />
          <div class={'tuner-cents' + (inTune ? ' ok' : '')}>
            {reading ? (Math.abs(cents) < 5 ? 'In tune' : `${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢ ${cents > 0 ? 'sharp: pull the headjoint out / roll out' : 'flat: push in / blow a bit faster'}`) : ''}
          </div>
          <canvas ref={canvas} class="tuner-trace" />
        </div>
        <div class="tuner-side">
          {fing && <FingeringDiagram inst={inst} fingering={fing} size={1.4} />}
          <div class="row-gap">
            {on ? <button class="ghost-btn" onClick={stop}>Stop</button> : <button class="primary-btn" onClick={() => void start()}>Start tuner</button>}
          </div>
          {err && <p class="warn-text">{err}</p>}
          <label class="field-row"><span>A4 =</span>
            <input type="number" min={415} max={466} value={a4} onChange={(e) => setA4(Number((e.target as HTMLInputElement).value) || 440)} style={{ width: '80px' }} /> Hz
          </label>
          <div class="field">
            <span>Reference drone</span>
            <div class="row-gap">
              <select value={droneKind} onChange={(e) => setDroneKind((e.target as HTMLSelectElement).value as DroneKind)}>
                {DRONES.map((d) => <option value={d.id}>{d.label}</option>)}
              </select>
              <button class={'chip' + (droneOn ? ' on' : '')} onClick={() => {
                engine.ensure();
                if (droneOn) { drone.stop(); setDroneOn(false); }
                else { drone.start(droneKind, inst.id === 'concert' || inst.id === 'recorder' ? 60 : root); setDroneOn(true); }
              }}>{droneOn ? 'Stop' : 'Play'}</button>
            </div>
            <small class="muted">Tune by ear against a steady {inst.id === 'bansuri' ? 'Sa' : 'tonic'}.</small>
          </div>
        </div>
      </div>
      <section class="article">
        <h2>How to tune a {inst.name.toLowerCase()}</h2>
        {inst.id === 'concert' && <p>Warm the flute up for a minute first: a cold flute plays flat. Play a steady A (or B♭) at a medium volume. If the tuner says sharp, pull the headjoint out a few millimetres; if flat, push it in. Then check a low and a high note: if the octaves disagree, work on your air speed and lip position rather than the headjoint.</p>}
        {inst.id === 'bansuri' && <p>A bansuri can't be retuned mechanically, so tuning is about your blowing. Set the drone to Sa, close the top three holes and play Sa softly and steadily. Rolling the flute towards you (covering more of the blow hole) lowers the pitch; rolling it away raises it. Komal notes made by half-holing are very sensitive: use the tuner to find exactly how much of the hole to cover.</p>}
        {inst.id === 'recorder' && <p>Pull the head joint out slightly to lower the pitch; push it in to raise it. Blow gently: recorders go sharp when you blow harder. Check the low notes with a relaxed breath and the high notes with a pinched thumb.</p>}
        {inst.id === 'whistle' && <p>If your whistle has a tunable head, slide it out to go flatter and in to go sharper. Tune the second octave G and A, then check the bottom D with gentle breath. Low notes go flat if you blow too softly.</p>}
      </section>
    </PageShell>
  );
}

function Gauge({ cents }: { cents: number | null }) {
  const c = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const angle = (c / 50) * 60;
  return (
    <svg viewBox="0 0 300 170" class="gauge">
      {Array.from({ length: 21 }, (_, i) => {
        const a = ((i - 10) / 10) * 60 * (Math.PI / 180);
        const r1 = 120, r2 = i % 5 === 0 ? 100 : 108;
        return <line x1={150 + r1 * Math.sin(a)} y1={150 - r1 * Math.cos(a)} x2={150 + r2 * Math.sin(a)} y2={150 - r2 * Math.cos(a)} stroke={i === 10 ? '#5fd39a' : 'rgba(255,255,255,0.35)'} stroke-width={i % 5 === 0 ? 2.5 : 1.2} />;
      })}
      <text x="40" y="160" class="gauge-lbl">−50</text>
      <text x="245" y="160" class="gauge-lbl">+50</text>
      {cents !== null && (
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '150px 150px', transition: 'transform 0.12s' }}>
          <line x1="150" y1="150" x2="150" y2="40" stroke={Math.abs(c) < 5 ? '#5fd39a' : '#f0b54d'} stroke-width="3.5" stroke-linecap="round" />
        </g>
      )}
      <circle cx="150" cy="150" r="7" fill="#e8edf1" />
    </svg>
  );
}

render(<Tuner />, document.getElementById('app')!);
