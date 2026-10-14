import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { panel, prefs, setPrefs, currentSong, instrument, root, showToast, tempoBpm } from '../state';
import { engine, ROOMS, type FxSettings, type RoomId } from '../audio/engine';
import { GROOVES, playClick } from '../audio/backing';
import { drone, droneRunning, DRONES, type DroneKind } from '../audio/drone';
import { Recorder, MAX_SECONDS, takes } from '../audio/recorder';
import { track } from '../analytics';
import { ensureAudio } from '../play';
import { droneSa } from '../songs/actions';
import { barLength, notesByBar } from '../music/song';
import { label } from './names';
import { FingeringDiagram } from './FingeringDiagram';
import { formatTime } from './SongsPanel';
import { IconClose, IconMetronome, IconRecord, IconSliders, IconStop, IconVolume, IconWave } from './icons';
import { songsTab } from '../state';

const recorder = new Recorder();
const recState = signal<{ on: boolean; elapsed: number }>({ on: false, elapsed: 0 });

export function SideRail() {
  const open = (p: typeof panel.value) => (panel.value = panel.value === p ? null : p);
  const rec = recState.value;
  return (
    <aside class="side-rail">
      <button class={'icon-btn' + (panel.value === 'mixer' ? ' on' : '')} onClick={() => open('mixer')} title="Volume"><IconVolume /></button>
      <button class={'icon-btn' + (panel.value === 'fx' ? ' on' : '')} onClick={() => open('fx')} title="Sound and effects"><IconSliders /></button>
      <button class={'icon-btn' + (panel.value === 'band' || droneRunning.value ? ' on' : '')} onClick={() => open('band')} title="Drone, metronome and band"><IconMetronome /></button>
      <button class={'icon-btn rec' + (rec.on ? ' live' : '')} onClick={() => (rec.on ? void stopRecording() : open('record'))} title={rec.on ? 'Stop recording' : 'Record'}>
        {rec.on ? <IconStop /> : <IconRecord />}
      </button>
      {rec.on && <span class="rec-time">{formatTime(rec.elapsed)}</span>}
    </aside>
  );
}

export function SidePanels() {
  const p = panel.value;
  if (p === 'mixer') return <Drawer title="Volume"><Mixer /></Drawer>;
  if (p === 'fx') return <Drawer title="Sound & effects"><Fx /></Drawer>;
  if (p === 'band') return <Drawer title="Drone, metronome & band"><Band /></Drawer>;
  if (p === 'record') return <Drawer title="Record"><RecordPanel /></Drawer>;
  if (p === 'sheet') return <Drawer title="Song notes" wide><Sheet /></Drawer>;
  return null;
}

function Drawer({ title, children, wide }: { title: string; children: ComponentChildren; wide?: boolean }) {
  return (
    <div class={'drawer' + (wide ? ' wide' : '')}>
      <div class="drawer-head">
        <h3>{title}</h3>
        <button class="icon-btn plain" onClick={() => (panel.value = null)} aria-label="Close"><IconClose size={18} /></button>
      </div>
      <div class="drawer-body">{children}</div>
    </div>
  );
}

function Slider(props: { label: string; value: number; min?: number; max?: number; step?: number; onInput: (v: number) => void; fmt?: (v: number) => string }) {
  const { min = 0, max = 1, step = 0.01 } = props;
  return (
    <label class="slider">
      <span>{props.label}</span>
      <input type="range" min={min} max={max} step={step} value={props.value} onInput={(e) => props.onInput(Number((e.target as HTMLInputElement).value))} />
      <output>{props.fmt ? props.fmt(props.value) : Math.round(props.value * 100)}</output>
    </label>
  );
}

function Mixer() {
  const v = prefs.value.volumes;
  const set = (k: keyof typeof v) => (x: number) => setPrefs({ volumes: { ...v, [k]: x } });
  return (
    <div class="stack">
      <Slider label="Master" value={v.master} max={1.2} onInput={set('master')} />
      <Slider label="Your flute" value={v.instrument} max={1.5} onInput={set('instrument')} />
      <Slider label="Guide melody" value={v.guide} max={1.5} onInput={set('guide')} />
      <Slider label="Band & drone" value={v.backing} max={1.5} onInput={set('backing')} />
      <Slider label="Metronome" value={v.click} max={1.5} onInput={set('click')} />
      <label class="check">
        <input type="checkbox" checked={prefs.value.guide} onChange={(e) => setPrefs({ guide: (e.target as HTMLInputElement).checked })} />
        Play the guide melody while I play along
      </label>
    </div>
  );
}

function Fx() {
  const fx = prefs.value.fx;
  const set = (patch: Partial<FxSettings>) => { ensureAudio(); setPrefs({ fx: { ...fx, ...patch } }); };
  const db = (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(0)} dB`;
  return (
    <div class="stack">
      <div class="field">
        <span>Flute sound</span>
        <div class="seg">
          <button class={prefs.value.sound === 'recorded' ? 'on' : ''} onClick={() => setPrefs({ sound: 'recorded' })}>Recorded</button>
          <button class={prefs.value.sound === 'modelled' ? 'on' : ''} onClick={() => setPrefs({ sound: 'modelled' })}>Modelled</button>
          <button class={prefs.value.sound === 'mine' ? 'on' : ''} onClick={() => setPrefs({ sound: 'mine' })}>My flute</button>
        </div>
        <button class="link gold" onClick={() => (panel.value = 'own')}>Record your own {instrument.value.name.toLowerCase()}…</button>
        <small class="muted">Recorded: real notes from a real {instrument.value.name.toLowerCase()}. Modelled: a physical model of the air jet and tube, smoother for slides and long tones. My flute: notes you recorded yourself.</small>
      </div>
      <div class="field">
        <span>Room</span>
        <div class="chips">
          {(Object.keys(ROOMS) as RoomId[]).map((r) => (
            <button class={'chip' + (fx.room === r ? ' on' : '')} onClick={() => set({ room: r })}>{ROOMS[r].label}</button>
          ))}
        </div>
      </div>
      <Slider label="Reverb" value={fx.reverb} onInput={(x) => set({ reverb: x })} />
      <Slider label="Echo" value={fx.delay} onInput={(x) => set({ delay: x })} />
      <Slider label="Echo time" value={fx.delayTime} min={0.08} max={1.2} onInput={(x) => set({ delayTime: x })} fmt={(x) => `${Math.round(x * 1000)} ms`} />
      <Slider label="Echo repeats" value={fx.delayFeedback} max={0.85} onInput={(x) => set({ delayFeedback: x })} />
      <Slider label="Body (bass)" value={fx.bass} min={-12} max={12} step={0.5} onInput={(x) => set({ bass: x })} fmt={db} />
      <Slider label="Presence" value={fx.mid} min={-12} max={12} step={0.5} onInput={(x) => set({ mid: x })} fmt={db} />
      <Slider label="Air (treble)" value={fx.treble} min={-12} max={12} step={0.5} onInput={(x) => set({ treble: x })} fmt={db} />
      <Slider label="Warmth" value={fx.warmth} onInput={(x) => set({ warmth: x })} />
      <div class="chips">
        <button class="chip" onClick={() => set({ reverb: 0.12, room: 'studio', delay: 0, warmth: 0.1, bass: 0, mid: 0, treble: 0 })}>Dry studio</button>
        <button class="chip" onClick={() => set({ reverb: 0.3, room: 'hall', delay: 0, warmth: 0.15, bass: 0, mid: 1, treble: 1 })}>Concert hall</button>
        <button class="chip" onClick={() => set({ reverb: 0.45, room: 'temple', delay: 0.15, delayTime: 0.42, delayFeedback: 0.3, warmth: 0.2, bass: 2, mid: 0, treble: -1 })}>Temple</button>
        <button class="chip" onClick={() => set({ reverb: 0.55, room: 'cathedral', delay: 0.2, delayTime: 0.6, delayFeedback: 0.45, warmth: 0.1, bass: 1, mid: -1, treble: 2 })}>Ambient</button>
      </div>
    </div>
  );
}

function Band() {
  const p = prefs.value;
  const b = p.band;
  const setBand = (patch: Partial<typeof b>) => setPrefs({ band: { ...b, ...patch } });
  const toggleDrone = () => {
    ensureAudio();
    if (drone.running) drone.stop();
    else { drone.setVolume(p.droneVolume); drone.start(p.drone, droneSa()); }
  };
  const [metro, setMetro] = useState(false);
  return (
    <div class="stack">
      <div class="field">
        <span>Drone</span>
        <div class="row-gap">
          <button class={'chip big' + (droneRunning.value ? ' on' : '')} onClick={toggleDrone}>
            <IconWave size={16} /> {droneRunning.value ? 'Drone on' : 'Start drone'}
          </button>
          <select value={p.drone} onChange={(e) => {
            const k = (e.target as HTMLSelectElement).value as DroneKind;
            setPrefs({ drone: k });
            if (drone.running) drone.start(k, droneSa());
          }}>
            {DRONES.map((d) => <option value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <small class="muted">Tuned to {label(instrument.value.id === 'bansuri' ? root.value : root.value || 60)}. Practise long tones and ragas against it.</small>
      </div>
      <Slider label="Drone volume" value={p.droneVolume} onInput={(x) => { drone.setVolume(x); setPrefs({ droneVolume: x }); }} />

      <div class="field">
        <span>Metronome</span>
        <label class="check">
          <input type="checkbox" checked={b.click} onChange={(e) => setBand({ click: (e.target as HTMLInputElement).checked })} />
          Click during songs
        </label>
        <label class="check">
          <input type="checkbox" checked={b.countIn} onChange={(e) => setBand({ countIn: (e.target as HTMLInputElement).checked })} />
          One-bar count-in
        </label>
        {!currentSong.value && <FreeMetronome on={metro} setOn={setMetro} />}
      </div>

      <div class="field">
        <span>Band</span>
        <label class="check"><input type="checkbox" checked={b.drums} onChange={(e) => setBand({ drums: (e.target as HTMLInputElement).checked })} /> Drums / tabla</label>
        <label class="check"><input type="checkbox" checked={b.bass} onChange={(e) => setBand({ bass: (e.target as HTMLInputElement).checked })} /> Bass</label>
        <label class="check"><input type="checkbox" checked={b.pad} onChange={(e) => setBand({ pad: (e.target as HTMLInputElement).checked })} /> Strings (auto chords)</label>
        <select value={b.groove} onChange={(e) => setBand({ groove: (e.target as HTMLSelectElement).value })}>
          <option value="auto">Rhythm: from the song</option>
          <option value="none">No drums</option>
          {(['Western', 'Folk', 'Indian'] as const).map((g) => (
            <optgroup label={g}>{GROOVES.filter((x) => x.group === g).map((x) => <option value={x.id}>{x.label}</option>)}</optgroup>
          ))}
        </select>
        <label class="check">
          <input type="checkbox" checked={p.anyOctave} onChange={(e) => setPrefs({ anyOctave: (e.target as HTMLInputElement).checked })} />
          "Wait for me" accepts the right note in any octave
        </label>
      </div>
    </div>
  );
}

/** A plain metronome when no song is loaded. */
function FreeMetronome({ on, setOn }: { on: boolean; setOn: (b: boolean) => void }) {
  const [bpm, setBpm] = useState(80);
  const [beats, setBeats] = useState(4);
  useEffect(() => {
    if (!on) return;
    ensureAudio();
    let next = engine.now + 0.05;
    let n = 0;
    const timer = window.setInterval(() => {
      while (next < engine.now + 0.15) {
        playClick(next, n % beats === 0, engine.click.input);
        next += 60 / bpm;
        n++;
      }
    }, 25);
    return () => clearInterval(timer);
  }, [on, bpm, beats]);
  return (
    <div class="row-gap">
      <button class={'chip' + (on ? ' on' : '')} onClick={() => setOn(!on)}>{on ? 'Stop' : 'Start'} metronome</button>
      <input type="number" min={20} max={260} value={bpm} onChange={(e) => setBpm(Number((e.target as HTMLInputElement).value))} style={{ width: '76px' }} />
      <small class="muted">BPM</small>
      <select value={beats} onChange={(e) => setBeats(Number((e.target as HTMLSelectElement).value))}>
        {[2, 3, 4, 6, 7].map((x) => <option value={x}>{x} beats</option>)}
      </select>
    </div>
  );
}

let recTimer = 0;
async function startRecording() {
  ensureAudio();
  try {
    await recorder.start();
  } catch {
    showToast('Recording is not supported in this browser.');
    return;
  }
  recorder.onLimit = () => void stopRecording();
  recState.value = { on: true, elapsed: 0 };
  recTimer = window.setInterval(() => {
    recState.value = { on: true, elapsed: recorder.elapsed };
    if (recorder.elapsed >= MAX_SECONDS) void stopRecording();
  }, 250);
  panel.value = null;
}

async function stopRecording() {
  clearInterval(recTimer);
  const res = await recorder.stop();
  recState.value = { on: false, elapsed: 0 };
  if (!res || res.seconds < 0.3) return;
  track('recording');
  const song = currentSong.value;
  const n = (await takes.list()).length + 1;
  await takes.save({
    id: 'take-' + Date.now().toString(36),
    name: song ? `${song.title} – take ${n}` : `Take ${n}`,
    created: Date.now(),
    seconds: res.seconds,
    wav: res.wav,
    compressed: res.compressed,
    instrument: instrument.value.name,
    song: song?.title,
  });
  showToast('Saved to Recordings.');
  songsTab.value = 'recordings';
  panel.value = 'songs';
}

function RecordPanel() {
  return (
    <div class="stack">
      <p class="muted">Records everything you hear: your flute, the guide, the band, the drone and effects. Up to 10 minutes. Takes are saved in this browser and can be downloaded as WAV or a small compressed file.</p>
      <button class="primary-btn" onClick={() => void startRecording()}><IconRecord size={16} /> Start recording</button>
      <button class="ghost-btn" onClick={() => { songsTab.value = 'recordings'; panel.value = 'songs'; }}>Open recordings</button>
    </div>
  );
}

/** Printable view of the song: bars of notes with a fingering for each new note. */
function Sheet() {
  const song = currentSong.value;
  if (!song) return <p class="muted">Load a song to see its notes.</p>;
  const inst = instrument.value;
  const r = root.value;
  const bars = notesByBar(song);
  const bl = barLength(song.time);
  const seen = new Set<number>();
  const sections = [...song.sections].sort((a, b) => a.start - b.start);
  return (
    <div class="sheet">
      <p class="muted">{song.title}{song.artist ? ` · ${song.artist}` : ''} · {Math.round(tempoBpm.value)} BPM. A fingering appears the first time each note is used.</p>
      <div class="sheet-bars">
        {bars.map((notes, i) => {
          const sec = sections.find((s) => Math.floor(s.start / bl + 1e-6) === i);
          return (
            <div class="sheet-bar">
              {sec && <div class="sheet-sec">{sec.name}</div>}
              <div class="sheet-num">{i + 1}</div>
              <div class="sheet-notes">
                {notes.map((n) => {
                  if (n.midi === null) return <span class="sn rest" style={{ flexGrow: n.dur }}>·</span>;
                  const first = !seen.has(n.midi);
                  seen.add(n.midi);
                  return (
                    <span class="sn" style={{ flexGrow: n.dur }}>
                      {first && <FingeringDiagram inst={inst} fingering={inst.fingering(n.midi, r)} size={0.6} />}
                      <b>{label(n.midi, { octave: false })}</b>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button class="ghost-btn small" onClick={() => window.print()}>Print</button>
    </div>
  );
}
