import { effect } from '@preact/signals';
import { transport, tablaHzForSa, transportState } from '../audio/transport';
import { drone } from '../audio/drone';
import { ensureAudio } from '../play';
import { currentSong, currentSourceSong, panel, prefs, root, setPrefs, tempoBpm, userTranspose, instrument } from '../state';
import type { Song } from '../music/song';

/** Load a song into the player (doesn't start it). */
export function loadSong(song: Song) {
  currentSourceSong.value = song;
  userTranspose.value = 0;
  tempoBpm.value = song.bpm;
  setPrefs({ band: { ...prefs.value.band, groove: 'auto' } });
}

export function closeSong() {
  transport.stop();
  currentSourceSong.value = null;
}

/** Load and start, in listen mode (the flute plays it for you). */
export function listen(song: Song) {
  ensureAudio();
  if (currentSourceSong.value?.id !== song.id) loadSong(song);
  setPrefs({ playMode: 'listen' });
  panel.value = null;
  queueMicrotask(() => transport.play(0));
}

/** Load and start in play-along mode. */
export function playAlong(song: Song) {
  ensureAudio();
  if (currentSourceSong.value?.id !== song.id) loadSong(song);
  if (prefs.value.playMode === 'listen') setPrefs({ playMode: 'along' });
  panel.value = null;
  if (song.drone && instrument.value.id === 'bansuri' && !drone.running) drone.start(prefs.value.drone, root.value);
  queueMicrotask(() => transport.play(0));
}

export function togglePlay() {
  ensureAudio();
  if (transportState.playing.value) transport.pause();
  else transport.play();
}

// Keep the transport's song, tempo and tabla tuning in step with the state.
effect(() => {
  const s = currentSong.value;
  transport.setSong(s);
  if (s) transport.setTempo(tempoBpm.peek());
});
effect(() => transport.setTempo(tempoBpm.value));
effect(() => {
  transport.tablaHz = tablaHzForSa(root.value);
  drone.setSa(root.value);
});
