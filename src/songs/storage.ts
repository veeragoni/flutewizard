import type { Song } from '../music/song';

/** Songs you write or import, kept in this browser. */

const KEY = 'flute.songs.v1';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadMySongs(): Song[] {
  const raw = safeGet(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Song[];
    return Array.isArray(list) ? list.filter((s) => s && s.id && Array.isArray(s.notes)) : [];
  } catch {
    return [];
  }
}

export function saveMySongs(songs: Song[]): boolean {
  return safeSet(KEY, JSON.stringify(songs));
}

export function upsertSong(songs: Song[], song: Song): Song[] {
  const s = { ...song, builtin: false, updatedAt: Date.now() };
  const i = songs.findIndex((x) => x.id === song.id);
  const next = i >= 0 ? songs.map((x, j) => (j === i ? s : x)) : [s, ...songs];
  saveMySongs(next);
  return next;
}

export function deleteSong(songs: Song[], id: string): Song[] {
  const next = songs.filter((s) => s.id !== id);
  saveMySongs(next);
  return next;
}

export function loadJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  safeSet(key, JSON.stringify(value));
}
