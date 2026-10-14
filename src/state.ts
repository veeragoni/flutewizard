import { computed, effect, signal } from '@preact/signals';
import { INSTRUMENTS, rootFor, timbreFor, tonicOf, type InstrumentId } from './instruments';
import { DEFAULT_FX, engine, type FxSettings } from './audio/engine';
import { setSoundSource } from './audio/modelVoice';
import { DEFAULT_BAND, transport, type BandSettings, type PlayMode } from './audio/transport';
import type { Song } from './music/song';
import { fitSong } from './songs/fit';
import { loadJSON, loadMySongs, saveJSON } from './songs/storage';
import type { DroneKind } from './audio/drone';

export type InputMode = 'keyboard' | 'fingers' | 'mic';
export type KeyLayout = 'scale' | 'chromatic';
export type NoteNaming = 'auto' | 'western' | 'sargam';

interface Prefs {
  instrument: InstrumentId;
  keys: Partial<Record<InstrumentId, number>>;
  /** How far the player's own flute sits from standard pitch (cents, from "Find my Sa"), per flute. */
  fluteCents?: Partial<Record<InstrumentId, number>>;
  inputMode: InputMode;
  layout: KeyLayout;
  naming: NoteNaming;
  fx: FxSettings;
  band: BandSettings;
  bandOn: boolean;
  playMode: PlayMode;
  guide: boolean;
  volumes: { master: number; instrument: number; guide: number; backing: number; click: number };
  drone: DroneKind;
  droneVolume: number;
  a4: number;
  anyOctave: boolean;
  showKeyboard: boolean;
  sound: 'recorded' | 'modelled' | 'mine';
}

const PREFS_KEY = 'flute.prefs.v1';

const defaults: Prefs = {
  instrument: 'bansuri',
  keys: {},
  inputMode: 'keyboard',
  layout: 'scale',
  naming: 'auto',
  fx: DEFAULT_FX,
  band: DEFAULT_BAND,
  bandOn: true,
  playMode: 'along',
  guide: true,
  volumes: { master: 0.9, instrument: 1, guide: 0.7, backing: 0.55, click: 0.6 },
  drone: 'tanpura-pa',
  droneVolume: 0.5,
  a4: 440,
  anyOctave: false,
  showKeyboard: true,
  sound: 'recorded',
};

const saved = loadJSON<Prefs>(PREFS_KEY, defaults);

export const prefs = signal<Prefs>({
  ...saved,
  fx: { ...DEFAULT_FX, ...saved.fx },
  band: { ...DEFAULT_BAND, ...saved.band },
  volumes: { ...defaults.volumes, ...saved.volumes },
});

export function setPrefs(patch: Partial<Prefs>) {
  prefs.value = { ...prefs.value, ...patch };
}

effect(() => saveJSON(PREFS_KEY, prefs.value));

export const instrument = computed(() => INSTRUMENTS[prefs.value.instrument]);
/** Root of the current instrument (Sa for bansuri, key for whistles). */
export const root = computed(() => rootFor(instrument.value, prefs.value.keys[prefs.value.instrument]));
export const tonic = computed(() => tonicOf(instrument.value, root.value));
export const naming = computed<'western' | 'sargam'>(() =>
  prefs.value.naming === 'auto' ? instrument.value.naming : prefs.value.naming);
export const timbre = computed(() => timbreFor(instrument.value, root.value));
export const range = computed(() => instrument.value.range(root.value));

/** Note the player is sounding right now (any input). */
export const activeNote = signal<number | null>(null);
/** Note whose fingering is shown when nothing is played (e.g. hovering the keyboard or the next song note). */
export const shownNote = signal<number | null>(null);
/** Fingers mode: which holes/keys are held. */
export const heldHoles = signal<number[]>([]);
export const heldKeys = signal<string[]>([]);
export const octaveShift = signal(0);

/* ─────────────────────────────── Songs ─────────────────────────────── */

export const mySongs = signal<Song[]>(loadMySongs());
/** The song as written (before fitting to the instrument). */
export const currentSourceSong = signal<Song | null>(null);
/** User transposition on top of the automatic fit, in semitones. */
export const userTranspose = signal(0);

/**
 * The song as it will be played on this instrument: sargam songs move to the flute's Sa,
 * everything is shifted by octaves to sit inside the range, then the player's transposition.
 */
export const currentSong = computed<Song | null>(() => {
  const s = currentSourceSong.value;
  return s ? fitSong(s, instrument.value, root.value, userTranspose.value) : null;
});

export const tempoBpm = signal(90);
export const loopOn = signal(false);

export type Panel = null | 'songs' | 'editor' | 'fx' | 'band' | 'mixer' | 'record' | 'help' | 'settings' | 'sheet' | 'own';
export const panel = signal<Panel>(null);
export const editorSongId = signal<string | null>(null);
export const songsTab = signal<'mine' | 'library' | 'recordings'>('library');
export const toast = signal<string | null>(null);

let toastTimer = 0;
export function showToast(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = null), 3200);
}

/* ──────────────── Keep the audio engine in sync with the state ──────────────── */

effect(() => {
  const p = prefs.value;
  if (!engine.ctx) return;
  engine.applyFx(p.fx);
  for (const [k, v] of Object.entries(p.volumes)) engine.setVolume(k as keyof Prefs['volumes'], v);
});

effect(() => {
  const p = prefs.value;
  transport.mode = p.playMode;
  transport.band = p.band;
  transport.bandOn = p.bandOn;
  transport.guide = p.guide;
  transport.anyOctave = p.anyOctave;
});

effect(() => {
  transport.loopWhole = loopOn.value;
});

effect(() => setSoundSource(prefs.value.sound));

/** Call after the first user gesture creates the AudioContext, so settings apply. */
export function syncAudio() {
  const p = prefs.value;
  engine.applyFx(p.fx);
  for (const [k, v] of Object.entries(p.volumes)) engine.setVolume(k as keyof Prefs['volumes'], v);
}
