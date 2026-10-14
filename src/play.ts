import { effect, signal } from '@preact/signals';
import { engine } from './audio/engine';
import { HybridVoice, loadFluteModel, type Voice } from './audio/modelVoice';
import { transport } from './audio/transport';
import { MicPitch, NoteTracker } from './audio/pitch';
import { nearestNote } from './music/theory';
import { noteFromFingers } from './instruments';
import {
  activeNote, heldHoles, heldKeys, instrument, naming, octaveShift, prefs, range, root, showToast, syncAudio, timbre,
} from './state';

/**
 * Turns the player's input (computer keyboard, on-screen keys, finger holes, microphone)
 * into notes on the flute voice.
 */

let voice: Voice | null = null;

export function ensureAudio() {
  const fresh = !engine.ctx;
  engine.ensure();
  if (fresh) syncAudio();
  if (fresh) void loadFluteModel().catch(() => {});
  if (!voice) voice = new HybridVoice(timbre.value, engine.instrument.input);
  transport.ensureVoice(timbre.value);
  return voice;
}

effect(() => {
  const t = timbre.value;
  voice?.setTimbre(t);
  transport.setTimbre(t);
});

/* ─────────────────────────── Note stack (mono) ─────────────────────────── */

const held: { id: string; midi: number }[] = [];
export const breath = signal(0.7);

function sound(midi: number | null, legato = true) {
  const v = ensureAudio();
  if (midi === null) {
    v.noteOff();
    activeNote.value = null;
    return;
  }
  const [lo, hi] = range.value;
  if (midi < lo || midi > hi) {
    showToast(`That note is outside the ${instrument.value.name.toLowerCase()}'s range.`);
    return;
  }
  const changed = activeNote.value !== midi;
  v.noteOn(midi, undefined, { breath: breath.value, legato });
  activeNote.value = midi;
  if (changed) transport.userNote(midi);
}

export function pressNote(id: string, midi: number) {
  const i = held.findIndex((h) => h.id === id);
  if (i >= 0) held.splice(i, 1);
  held.push({ id, midi });
  sound(midi, true);
}

export function releaseNote(id: string) {
  const i = held.findIndex((h) => h.id === id);
  if (i < 0) return;
  const wasTop = i === held.length - 1;
  held.splice(i, 1);
  if (!wasTop) return;
  const next = held[held.length - 1];
  // Last-note priority: fall back to a key that's still down, slurred.
  if (next) sound(next.midi, true);
  else sound(null);
}

export function releaseAll() {
  held.length = 0;
  fingerState.blowing = false;
  if (voice) voice.noteOff();
  activeNote.value = null;
}

/* ─────────────────────────── Keyboard layouts ─────────────────────────── */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export const SCALE_ROWS: string[][] = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];

/** Tracker-style chromatic layout: two rows of piano keys, white keys on letters, black above. */
const CHROMATIC: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
  Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31,
};

export const KEY_LABEL: Record<string, string> = {
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Equal: '=',
  Space: 'Space', ShiftLeft: 'Shift', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
export const keyLabel = (code: string) => KEY_LABEL[code] ?? code.replace(/^Key|^Digit/, '');

/** MIDI note for a key in Keyboard mode, or null. `alt` = Shift (komal/tivra in sargam, sharp otherwise). */
export function noteForKey(code: string, alt = false): number | null {
  const base = instrument.value.layoutBase(root.value) + octaveShift.value * 12;
  if (prefs.value.layout === 'chromatic') {
    const off = CHROMATIC[code];
    return off === undefined ? null : base + off;
  }
  for (let row = 0; row < 3; row++) {
    const idx = SCALE_ROWS[row].indexOf(code);
    if (idx < 0) continue;
    const octave = 2 - row;
    const deg = idx % 7;
    let semis = MAJOR[deg] + 12 * Math.floor(idx / 7) + 12 * octave;
    if (alt) {
      if (naming.value === 'sargam') {
        if (deg === 3) semis += 1; // tivra Ma
        else if (deg === 1 || deg === 2 || deg === 5 || deg === 6) semis -= 1; // komal
      } else {
        semis += 1;
      }
    }
    return base + semis;
  }
  return null;
}

/* ─────────────────────────── Fingers mode ─────────────────────────── */

/** Home row = full cover, the key above = half cover. Holes are ordered from the mouthpiece. */
const HOLE_KEYS_6 = { full: ['KeyF', 'KeyD', 'KeyS', 'KeyJ', 'KeyK', 'KeyL'], half: ['KeyR', 'KeyE', 'KeyW', 'KeyU', 'KeyI', 'KeyO'] };
const HOLE_KEYS_REC = {
  full: ['KeyV', 'KeyF', 'KeyD', 'KeyS', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  half: ['KeyB', 'KeyR', 'KeyE', 'KeyW', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
};
export const CONCERT_KEYS: Record<string, string> = {
  KeyV: 'T', KeyB: 'Tb', KeyF: 'L1', KeyD: 'L2', KeyS: 'L3', KeyA: 'Gs',
  KeyJ: 'R1', KeyK: 'R2', KeyL: 'R3', Semicolon: 'Eb', Quote: 'Cs', Slash: 'C', KeyU: 'Tr1', KeyI: 'Tr2',
};

export function holeKeys() {
  return instrument.value.id === 'recorder' ? HOLE_KEYS_REC : HOLE_KEYS_6;
}

const fingerState = { blowing: false, down: new Set<string>(), overblow: 0 };

function fingersChanged() {
  const inst = instrument.value;
  let midi: number | null = null;
  if (inst.id === 'concert') {
    const keys = [...fingerState.down].map((c) => CONCERT_KEYS[c]).filter(Boolean);
    heldKeys.value = keys;
    midi = noteFromFingers(inst, root.value, { keys }, fingerState.overblow)?.midi ?? null;
  } else {
    const { full, half } = holeKeys();
    const holes = full.map((k, i) => (fingerState.down.has(k) ? 1 : fingerState.down.has(half[i]) ? 0.5 : 0));
    heldHoles.value = holes;
    midi = noteFromFingers(inst, root.value, { holes }, fingerState.overblow)?.midi ?? null;
  }
  if (fingerState.blowing) {
    if (midi !== null) sound(midi, true);
    else sound(null);
  } else {
    // Show what the fingering would play, without sounding it.
    fingerPreview.value = midi;
  }
}

export const fingerPreview = signal<number | null>(null);

/** Toggle a hole/key from the on-screen flute (touch/mouse). */
export function setFinger(code: string, down: boolean) {
  if (down) fingerState.down.add(code);
  else fingerState.down.delete(code);
  fingersChanged();
}

export function setBlow(on: boolean) {
  fingerState.blowing = on;
  if (on) {
    ensureAudio();
    fingersChanged();
  } else sound(null);
}

export function setOverblow(level: number) {
  fingerState.overblow = level;
  fingersChanged();
}

/* ─────────────────────────── Computer keyboard ─────────────────────────── */

const downCodes = new Set<string>();
export const pressedCodes = signal<Set<string>>(new Set());
export const bendCents = signal(0);
export const vibratoHeld = signal(false);

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function onKeyDown(e: KeyboardEvent) {
  if (isTyping(e) || e.metaKey || e.ctrlKey) return;
  const mode = prefs.value.inputMode;
  if (mode === 'mic') return;
  const code = e.code;
  if (code === 'ArrowUp' || code === 'ArrowDown') {
    if (mode === 'keyboard') {
      octaveShift.value = Math.max(-2, Math.min(2, octaveShift.value + (code === 'ArrowUp' ? 1 : -1)));
      e.preventDefault();
    }
    return;
  }
  if (e.repeat) {
    if (code === 'Space' || downCodes.has(code)) e.preventDefault();
    return;
  }
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    bendCents.value = code === 'ArrowLeft' ? -100 : 100;
    voice?.setBend(bendCents.value, 0.25);
    e.preventDefault();
    return;
  }
  if (mode === 'keyboard') {
    if (code === 'Space') {
      vibratoHeld.value = true;
      voice?.setVibrato(1);
      e.preventDefault();
      return;
    }
    const midi = noteForKey(code, e.shiftKey);
    if (midi === null) return;
    e.preventDefault();
    downCodes.add(code);
    pressedCodes.value = new Set(downCodes);
    pressNote('key:' + code, midi);
    return;
  }
  // Fingers mode.
  if (code === 'Space') { setBlow(true); e.preventDefault(); return; }
  if (code === 'ShiftLeft' || code === 'ShiftRight') { setOverblow(fingerState.overblow + 1); return; }
  if (code === 'KeyH') { setOverblow(fingerState.overblow + 1); e.preventDefault(); return; }
  e.preventDefault();
  downCodes.add(code);
  pressedCodes.value = new Set(downCodes);
  setFinger(code, true);
}

function onKeyUp(e: KeyboardEvent) {
  const mode = prefs.value.inputMode;
  const code = e.code;
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    bendCents.value = 0;
    voice?.setBend(0, 0.15);
    return;
  }
  if (mode === 'keyboard') {
    if (code === 'Space') {
      vibratoHeld.value = false;
      voice?.setVibrato(0);
      return;
    }
    if (!downCodes.delete(code)) return;
    pressedCodes.value = new Set(downCodes);
    releaseNote('key:' + code);
    return;
  }
  if (mode === 'fingers') {
    if (code === 'Space') { setBlow(false); return; }
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyH') { setOverblow(Math.max(0, fingerState.overblow - 1)); return; }
    downCodes.delete(code);
    pressedCodes.value = new Set(downCodes);
    setFinger(code, false);
  }
}

function onBlur() {
  downCodes.clear();
  pressedCodes.value = new Set();
  fingerState.down.clear();
  fingerState.overblow = 0;
  heldHoles.value = [];
  heldKeys.value = [];
  releaseAll();
}

let installed = false;
export function installKeyboard() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
}

// Switching modes or instruments drops anything held.
effect(() => {
  void prefs.value.inputMode;
  void prefs.value.instrument;
  onBlur();
});

/* ─────────────────────────── Microphone ("My flute") ─────────────────────────── */

export const mic = new MicPitch();
export const micReading = signal<{ midi: number | null; cents: number; freq: number | null; level: number }>({ midi: null, cents: 0, freq: null, level: 0 });
export const micOn = signal(false);

export async function startMic() {
  if (mic.active) return;
  ensureAudio();
  const [lo, hi] = range.value;
  mic.minFreq = 440 * Math.pow(2, (lo - 2 - 69) / 12);
  mic.maxFreq = 440 * Math.pow(2, (hi + 2 - 69) / 12);
  const tracker = new NoteTracker((midi) => {
    activeNote.value = midi;
    if (midi !== null) transport.userNote(midi);
  });
  try {
    await mic.start((r) => {
      if (r.freq && r.clarity > 0.8) {
        const n = nearestNote(r.freq, prefs.value.a4);
        micReading.value = { midi: n.midi, cents: n.cents, freq: r.freq, level: r.level };
        tracker.push(n.midi);
      } else {
        micReading.value = { ...micReading.value, midi: null, freq: null, level: r.level };
        tracker.push(null);
      }
    });
    micOn.value = true;
  } catch {
    showToast('Microphone access was blocked. Allow it in your browser to use "My flute".');
    setInputMode('keyboard');
  }
}

export function stopMic() {
  mic.stop();
  micOn.value = false;
  activeNote.value = null;
}

export function setInputMode(mode: 'keyboard' | 'fingers' | 'mic') {
  prefs.value = { ...prefs.value, inputMode: mode };
  if (mode === 'mic') void startMic();
  else if (mic.active) stopMic();
}
