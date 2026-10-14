/**
 * Physical model of a flute (jet-drive waveguide), after Perry Cook's STK Flute, with additions
 * for realism:
 *   - an air jet that hits the edge (the "jet table" nonlinearity) driving a tube (a delay line
 *     with lossy, inverting reflections) — this is what makes the tone, chiff and overblowing;
 *   - turbulent breath noise, part of which is filtered by the tube itself so the airiness
 *     carries the note's harmonics, as on a real flute;
 *   - slow random drift ("jitter") in pressure and pitch, since no player holds air perfectly still;
 *   - breath vibrato (mostly in pressure, slightly in pitch);
 *   - a body resonance filter per instrument (bamboo, metal, wood).
 *
 * Plain JavaScript so it can run as an AudioWorklet and also be imported by tests.
 */

const TWO_PI = Math.PI * 2;

/** One-pole lowpass with gain; its phase delay at frequency f (in samples) is needed for tuning. */
function onePolePhaseDelay(pole, f, sr) {
  const w = (TWO_PI * f) / sr;
  // H = (1 - p) / (1 - p e^{-jw}); phase = -atan2(p sin w, 1 - p cos w)
  const phase = Math.atan2(pole * Math.sin(w), 1 - pole * Math.cos(w));
  return phase / w;
}

/**
 * Measured pitch error of the model (cents sharp) at MIDI 48, 50, … 100, for tube brightness 4 and 5,
 * with jetRatio 0.5. Produced by tests/flute-tune.test.ts; independent of breath pressure.
 */
const TUNE_B4 = [36.9, 32.0, 29.4, 26.4, 24.7, 22.7, 21.2, 19.6, 18.4, 17.2, 15.8, 15.2, 14.0, 13.7, 12.8, 11.9, 11.6, 11.0, 9.8, 8.9, 9.5, 9.0, 7.9, 7.4, 6.9, 12.1, 10.8];
const TUNE_B5 = [33.6, 28.2, 24.6, 22.3, 20.7, 19.1, 17.9, 16.3, 15.3, 14.3, 13.1, 12.7, 11.8, 11.1, 10.5, 9.6, 9.1, 9.1, 8.1, 7.7, 8.1, 8.3, 6.0, 5.6, 5.0, 9.8, 13.2];

export function tuningCents(midi, brightness) {
  const x = Math.max(0, Math.min(TUNE_B4.length - 1.001, (midi - 48) / 2));
  const i = Math.floor(x), t = x - i;
  const a = TUNE_B4[i] + (TUNE_B4[i + 1] - TUNE_B4[i]) * t;
  const b = TUNE_B5[i] + (TUNE_B5[i + 1] - TUNE_B5[i]) * t;
  const k = Math.max(0, Math.min(1, brightness - 4));
  return a + (b - a) * k;
}

export const DEFAULT_PARAMS = {
  frequency: 440,
  pressure: 0, // breath pressure 0..1 (envelope)
  noise: 0.12, // turbulence amount
  jetRatio: 0.5, // jet travel time in periods — the embouchure; smaller = sharper, overblows more easily
  jetReflection: 0.5,
  endReflection: 0.5,
  brightness: 4, // tube loss cutoff, in harmonics of the note: lower = darker, more stable
  vibratoRate: 5,
  vibratoDepth: 0, // 0..1
  pitchBend: 0, // cents
  airMix: 0.5, // extra breath noise heard directly
  gain: 1,
};

export class FluteDSP {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.size = 8192;
    this.bore = new Float32Array(this.size);
    this.jet = new Float32Array(this.size);
    this.w = 0;
    this.lp = 0;
    this.dcX = 0;
    this.dcY = 0;
    this.vibPhase = Math.random();
    this.air1 = 0;
    this.air2 = 0;
    // Smoothed parameter state.
    this.p = { ...DEFAULT_PARAMS };
    this.freqS = 440;
    this.pressS = 0;
    // Slow random drift: two smoothed random walks.
    this.drift = 0;
    this.driftTarget = 0;
    this.driftCount = 0;
    this.seed = 22222;
    // Tuning correction, measured offline (see tests): multiplies the requested frequency.
    this.tune = 1;
    // Tube geometry: loop length in periods and reflection sign (see tests for how these were chosen).
    this.boreScale = 1;
    this.sign = 1;
  }

  rand() {
    // xorshift: fast, deterministic noise in [-1, 1].
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 4294967295) * 2 - 1;
  }

  read(buf, delay) {
    let r = this.w - delay;
    while (r < 0) r += this.size;
    const i = Math.floor(r);
    const fr = r - i;
    const a = buf[i % this.size];
    const b = buf[(i + 1) % this.size];
    return a + (b - a) * fr;
  }

  /**
   * Render n samples into out (Float32Array). `params` holds either numbers or Float32Arrays
   * (a-rate) per key; numbers are used for the whole block.
   */
  process(out, n, params) {
    const sr = this.sr;
    const P = this.p;
    for (const k in params) {
      const v = params[k];
      P[k] = typeof v === 'number' ? v : v[v.length - 1];
    }
    const fArr = params.frequency && typeof params.frequency !== 'number' && params.frequency.length > 1 ? params.frequency : null;
    const pArr = params.pressure && typeof params.pressure !== 'number' && params.pressure.length > 1 ? params.pressure : null;

    const jr = P.jetRatio;
    // Pitch correction for this note (measured, see tuningCents), plus any bend.
    const midiNow = 69 + 12 * Math.log2((fArr ? fArr[n - 1] : P.frequency) / 440);
    const bendMul = Math.pow(2, (P.pitchBend - tuningCents(midiNow, P.brightness)) / 1200);
    const vibInc = P.vibratoRate / sr;

    for (let i = 0; i < n; i++) {
      const targetF = (fArr ? fArr[i] : P.frequency) * bendMul;
      // Short glide so finger changes and bends are smooth, not stepped.
      this.freqS += (targetF - this.freqS) * 0.004;
      const press = pArr ? pArr[i] : P.pressure;
      this.pressS += (press - this.pressS) * 0.01;

      // Drift: pick a new random target every ~80 ms and glide to it.
      if (--this.driftCount <= 0) {
        this.driftCount = (sr * 0.08) | 0;
        this.driftTarget = this.rand();
      }
      this.drift += (this.driftTarget - this.drift) * 0.0004;

      this.vibPhase += vibInc;
      if (this.vibPhase >= 1) this.vibPhase -= 1;
      const vib = Math.sin(TWO_PI * this.vibPhase) * P.vibratoDepth;

      // Pitch: drift of ±3 cents plus a little pitch vibrato.
      const f = this.freqS * this.tune * (1 + this.drift * 0.0017 + vib * 0.006);
      // Tube length: account for the loop filter and interpolation delays so the note is in tune.
      // The inverting reflection makes the loop resonate at half the round trip, so the tube is half a period.
      // Tube losses scale with pitch: the loop lowpass cutoff sits `brightness` harmonics above the note.
      // This keeps low notes from jumping to the third harmonic, as real tubes damp high modes.
      const pole = Math.exp((-TWO_PI * Math.min(sr * 0.45, P.brightness * f)) / sr);
      const period = sr / f;
      const loopDelay = this.boreScale * period - onePolePhaseDelay(pole, f, sr);
      const boreDelay = Math.max(2, Math.min(this.size - 4, loopDelay));
      const jetDelay = Math.max(1, period * jr);

      // Breath: pressure with turbulence, vibrato and drift.
      const turb = this.rand();
      const breath = this.pressS * (1 + vib * 0.06 + this.drift * 0.02) + this.pressS * P.noise * turb;

      // Tube output (previous sample) through the lossy, inverting end reflection.
      const boreOut = this.read(this.bore, boreDelay);
      this.lp = (1 - pole) * this.sign * boreOut + pole * this.lp;
      // DC blocker.
      const dc = this.lp - this.dcX + 0.995 * this.dcY;
      this.dcX = this.lp;
      this.dcY = dc;

      // Jet: breath minus the tube's push-back, travels across the mouth hole, hits the edge.
      const pd = breath - P.jetReflection * dc;
      this.jet[this.w] = pd;
      let j = this.read(this.jet, jetDelay);
      j = j * (j * j - 1);
      if (j > 1) j = 1;
      else if (j < -1) j = -1;
      this.bore[this.w] = j + P.endReflection * dc;

      // Direct breath noise heard near the embouchure, band-limited (two one-poles).
      this.air1 += (turb - this.air1) * 0.35;
      this.air2 += (this.air1 - this.air2) * 0.35;
      const air = (turb - this.air2) * this.pressS * P.airMix * 0.08;

      // Most of a flute's vibrato is heard as a swell in loudness.
      out[i] = (0.3 * boreOut * (1 + vib * 0.3) + air) * P.gain;
      this.w = (this.w + 1) % this.size;
    }
  }
}

if (typeof registerProcessor === 'function') {
  const NAMES = Object.keys(DEFAULT_PARAMS);
  // eslint-disable-next-line no-undef
  class FluteProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return NAMES.map((name) => ({
        name,
        defaultValue: DEFAULT_PARAMS[name],
        automationRate: name === 'frequency' || name === 'pressure' ? 'a-rate' : 'k-rate',
      }));
    }
    constructor(options) {
      super();
      // eslint-disable-next-line no-undef
      this.dsp = new FluteDSP(sampleRate);
      const t = options && options.processorOptions && options.processorOptions.tune;
      if (t) this.dsp.tune = t;
      this.alive = true;
      this.port.onmessage = (e) => {
        if (e.data === 'dispose') this.alive = false;
        else if (e.data && e.data.tune) this.dsp.tune = e.data.tune;
      };
    }
    process(_inputs, outputs, parameters) {
      const out = outputs[0][0];
      if (!out) return this.alive;
      const params = {};
      for (const k of NAMES) {
        const v = parameters[k];
        params[k] = v.length === 1 ? v[0] : v;
      }
      this.dsp.process(out, out.length, params);
      for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
      return this.alive;
    }
  }
  registerProcessor('flute-model', FluteProcessor);
}
