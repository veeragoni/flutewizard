import { effect, untracked } from '@preact/signals';
import { transport, tablaHzForSa, transportState } from '../audio/transport';
import { drone } from '../audio/drone';
import { ensureAudio } from '../play';
import { currentSong, currentSourceSong, panel, prefs, root, setPrefs, songKeys, tempoBpm, userTranspose, instrument } from '../state';
import type { Song } from '../music/song';
import { track } from '../analytics';

/** Built-in songs by name; the player's own songs only as "own". */
function trackSong(song: Song | null, how: string) {
  if (song) track(`song/${how}/${song.builtin ? song.id.replace(/^builtin-/, '') : 'own'}`);
}

// Set when a song turned the band off by default, so the next song gets it back.
let bandOffBySong = false;

/** Load a song into the player (doesn't start it). */
export function loadSong(song: Song) {
  songKeys.value = song.keys ?? null;
  if (song.band === false && prefs.value.bandOn) {
    setPrefs({ bandOn: false });
    bandOffBySong = true;
  } else if (song.band !== false && bandOffBySong) {
    if (!prefs.value.bandOn) setPrefs({ bandOn: true });
    bandOffBySong = false;
  }
  currentSourceSong.value = song;
  userTranspose.value = 0;
  tempoBpm.value = song.bpm;
  setPrefs({ band: { ...prefs.value.band, groove: 'auto' } });
}

export function closeSong() {
  transport.stop();
  currentSourceSong.value = null;
  songKeys.value = null;
  if (bandOffBySong) {
    if (!prefs.value.bandOn) setPrefs({ bandOn: true });
    bandOffBySong = false;
  }
}

/** Load and start, in listen mode (the flute plays it for you). */
export function listen(song: Song) {
  ensureAudio();
  if (currentSourceSong.value !== song) loadSong(song);
  setPrefs({ playMode: 'listen' });
  trackSong(song, 'listen');
  panel.value = null;
  queueMicrotask(() => transport.play(0));
}

/** Load and start in play-along mode. */
export function playAlong(song: Song) {
  ensureAudio();
  if (currentSourceSong.value !== song) loadSong(song);
  if (prefs.value.playMode === 'listen') setPrefs({ playMode: 'along' });
  trackSong(song, prefs.value.playMode);
  panel.value = null;
  if (song.drone && !song.droneKind && instrument.value.id === 'bansuri' && !drone.running) drone.start(prefs.value.drone, root.value);
  queueMicrotask(() => transport.play(0));
}

export function togglePlay() {
  ensureAudio();
  if (transportState.playing.value) transport.pause();
  else {
    trackSong(currentSourceSong.value, prefs.value.playMode);
    transport.play();
  }
}

// Keep the transport's song, tempo and tabla tuning in step with the state. The transport and drone
// calls run untracked: they read state such as "playing", and an effect that subscribed to that
// would reload the song (and so stop it) the moment playback starts.
effect(() => {
  const s = currentSong.value;
  untracked(() => {
    transport.setSong(s);
    if (s) transport.setTempo(tempoBpm.peek());
  });
});
effect(() => {
  const bpm = tempoBpm.value;
  untracked(() => transport.setTempo(bpm));
});
effect(() => {
  const sa = droneSa();
  const hz = tablaHzForSa(root.value);
  untracked(() => {
    transport.tablaHz = hz;
    drone.setSa(sa);
  });
});

/** Sa for the drone: the bansuri's Sa, or the song's key on the other flutes. */
export function droneSa() {
  return instrument.value.id === 'bansuri' ? root.value : 60 + (currentSong.value?.tonic ?? 0);
}

// A song with its own drone (a shruti box instead of a metronome) sounds it while it plays.
let songDrone = false;
effect(() => {
  const kind = currentSong.value?.droneKind;
  const sa = droneSa();
  const playing = transportState.playing.value;
  untracked(() => {
    if (playing && kind) {
      if (!drone.running) {
        drone.setVolume(prefs.value.droneVolume);
        drone.start(kind, sa);
        songDrone = true;
      }
    } else if (songDrone) {
      if (drone.running) drone.stop();
      songDrone = false;
    }
  });
});
