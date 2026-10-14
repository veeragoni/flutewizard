import { engine } from './engine';
import { midiToFreq } from '../music/theory';

/**
 * Practice drones that run independently of song playback.
 *  - tanpura: four plucked strings (Pa/Ma/Ni, Sa', Sa', Sa) in a slow cycle, with the
 *    "jawari" buzz that blooms after each pluck.
 *  - shruti: a sustained reed drone on Sa and Pa (shruti box / harmonium).
 *  - tonic: a soft sustained tonic, useful for long-tone practice on any flute.
 */

export type DroneKind = 'tanpura-pa' | 'tanpura-ma' | 'tanpura-ni' | 'shruti' | 'tonic';

export const DRONES: { id: DroneKind; label: string }[] = [
  { id: 'tanpura-pa', label: 'Tanpura (Pa)' },
  { id: 'tanpura-ma', label: 'Tanpura (Ma)' },
  { id: 'tanpura-ni', label: 'Tanpura (Ni)' },
  { id: 'shruti', label: 'Shruti box (Sa + Pa)' },
  { id: 'tonic', label: 'Sustained tonic' },
];

class Drone {
  private out: GainNode | null = null;
  private timer: number | null = null;
  private sustained: OscillatorNode[] = [];
  private nextPluck = 0;
  private step = 0;
  kind: DroneKind = 'tanpura-pa';
  sa = 60;
  /** Seconds per tanpura cycle (4 plucks). */
  cycle = 4.4;
  volume = 0.5;
  running = false;

  start(kind: DroneKind, sa: number) {
    this.stop();
    const ctx = engine.ensure();
    this.kind = kind;
    this.sa = sa;
    this.out = new GainNode(ctx, { gain: 0 });
    this.out.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.3);
    this.out.connect(engine.backing.input);
    this.running = true;
    if (kind.startsWith('tanpura')) {
      this.nextPluck = ctx.currentTime + 0.05;
      this.step = 0;
      this.timer = window.setInterval(() => this.schedulePlucks(), 100);
      this.schedulePlucks();
    } else {
      this.startSustained();
    }
  }

  stop() {
    if (!this.out) return;
    const ctx = engine.ctx;
    const out = this.out;
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const oscs = this.sustained;
    setTimeout(() => {
      for (const o of oscs) o.stop();
      out.disconnect();
    }, 1500);
    this.sustained = [];
    this.out = null;
    this.running = false;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.out) this.out.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.1);
  }

  /** Retune while running. */
  setSa(sa: number) {
    if (this.running && sa !== this.sa) this.start(this.kind, sa);
    else this.sa = sa;
  }

  private get firstString(): number {
    // The first string sits below Sa: Pa (−5), Ma (−7) or Ni (−1) of the lower octave.
    if (this.kind === 'tanpura-ma') return this.sa - 7;
    if (this.kind === 'tanpura-ni') return this.sa - 1;
    return this.sa - 5;
  }

  private schedulePlucks() {
    if (!this.out) return;
    const ctx = engine.ctx;
    const gap = this.cycle / 4;
    // Keep the drone below the flute: Sa sits around octave 3.
    let sa = this.sa;
    while (sa > 55) sa -= 12;
    const strings = [this.firstString - (this.sa - sa), sa + 12, sa + 12, sa];
    while (this.nextPluck < ctx.currentTime + 0.5) {
      const midi = strings[this.step % 4];
      // The last (low Sa) string rings longest; the cycle breathes slightly.
      pluck(midi, this.nextPluck, this.step % 4 === 3 ? 3.8 : 3, this.out);
      this.nextPluck += gap * (this.step % 4 === 3 ? 1.25 : 1);
      this.step++;
    }
  }

  private startSustained() {
    const ctx = engine.ctx;
    let sa = this.sa;
    while (sa > 57) sa -= 12;
    const notes = this.kind === 'shruti' ? [sa, sa + 7, sa + 12] : [sa, sa + 12];
    const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: this.kind === 'shruti' ? 1600 : 900, Q: 0.6 });
    // A slow swell imitates the bellows of a shruti box.
    const swell = new OscillatorNode(ctx, { frequency: 0.23 });
    const swellDepth = new GainNode(ctx, { gain: 0.05 });
    const level = new GainNode(ctx, { gain: 0.12 });
    swell.connect(swellDepth).connect(level.gain);
    lp.connect(level).connect(this.out!);
    swell.start();
    this.sustained.push(swell);
    for (const m of notes) {
      for (const det of [-4, 5]) {
        const o = new OscillatorNode(ctx, {
          type: this.kind === 'shruti' ? 'sawtooth' : 'triangle',
          frequency: midiToFreq(m),
          detune: det,
        });
        o.connect(new GainNode(ctx, { gain: m === sa ? 0.5 : 0.35 })).connect(lp);
        o.start();
        this.sustained.push(o);
      }
    }
  }
}

/** A plucked, buzzing string: bright harmonics whose brightness swells then fades (jawari). */
function pluck(midi: number, when: number, decay: number, out: AudioNode) {
  const ctx = engine.ctx;
  const f = midiToFreq(midi);
  const o = new OscillatorNode(ctx, { type: 'sawtooth', frequency: f });
  const o2 = new OscillatorNode(ctx, { type: 'sawtooth', frequency: f * 1.0015 });
  const bp = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 4 });
  bp.frequency.setValueAtTime(f * 3, when);
  bp.frequency.linearRampToValueAtTime(f * 9, when + 0.35);
  bp.frequency.setTargetAtTime(f * 2, when + 0.4, decay / 3);
  const g = new GainNode(ctx, { gain: 0 });
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.16, when + 0.008);
  g.gain.setTargetAtTime(0.0001, when + 0.05, decay / 3.5);
  o.connect(bp);
  o2.connect(bp);
  bp.connect(g).connect(out);
  for (const x of [o, o2]) {
    x.start(when);
    x.stop(when + decay * 1.5);
  }
}

export const drone = new Drone();
