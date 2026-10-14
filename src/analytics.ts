/**
 * Anonymous usage counts. Page views, referrers, countries and devices come from Cloudflare Web
 * Analytics, a script added to every page at build time (see vite.config.ts). Cloudflare can't count
 * events, so `track()` sends them to GoatCounter when a code is configured (VITE_GOATCOUNTER) and
 * drops them otherwise. Nothing personal is sent: no song text, recordings or names of your songs.
 */
declare global {
  interface Window {
    goatcounter?: { count?: (v: { path: string; title?: string; event?: boolean }) => void };
  }
}

const code = import.meta.env.VITE_GOATCOUNTER as string | undefined;
const queue: string[] = [];
const lastSent = new Map<string, number>();
let loading = false;

function flush() {
  const count = window.goatcounter?.count;
  if (!count) return;
  for (const path of queue.splice(0)) count({ path, title: path, event: true });
}

function load() {
  if (loading || !code) return;
  loading = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  // Page views are Cloudflare's job; GoatCounter only counts events.
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
  s.onload = flush;
  document.head.append(s);
}

/** Counts one event, such as "flute/bansuri" or "song/twinkle". Repeats within 5 s are ignored. */
export function track(event: string) {
  if (!code || typeof window === 'undefined') return;
  const now = Date.now();
  if (now - (lastSent.get(event) ?? 0) < 5000) return;
  lastSent.set(event, now);
  queue.push(event);
  load();
  flush();
}
