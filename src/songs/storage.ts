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

const EDITS_KEY = 'flute.builtin-edits.v1';

/** The player's corrected versions of built-in songs, by song id. */
export function loadEdits(): Record<string, Song> {
  const raw = safeGet(EDITS_KEY);
  if (!raw) return {};
  try {
    const map = JSON.parse(raw) as Record<string, Song>;
    return map && typeof map === 'object' ? Object.fromEntries(Object.entries(map).filter(([, s]) => s && Array.isArray(s.notes))) : {};
  } catch {
    return {};
  }
}

export function saveEdit(edits: Record<string, Song>, song: Song): Record<string, Song> {
  const next = { ...edits, [song.id]: { ...song, builtin: true, edited: true, updatedAt: Date.now() } };
  safeSet(EDITS_KEY, JSON.stringify(next));
  return next;
}

export function resetEdit(edits: Record<string, Song>, id: string): Record<string, Song> {
  const next = { ...edits };
  delete next[id];
  safeSet(EDITS_KEY, JSON.stringify(next));
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
