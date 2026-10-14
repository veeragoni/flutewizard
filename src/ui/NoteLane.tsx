import { useEffect, useRef } from 'preact/hooks';
import { transportState } from '../audio/transport';
import { barLength, pitchRange } from '../music/song';
import { activeNote, currentSong, instrument, root } from '../state';
import { label } from './names';

/**
 * Scrolling note highway: the song moves right-to-left past a playhead. Height = pitch,
 * length = duration. Your live note shows as a marker on the playhead.
 */
export function NoteLane() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const song = currentSong.value;
  const lyricRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !song) return;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const range = pitchRange(song) ?? [60, 72];
    const lo = range[0] - 1, hi = range[1] + 1;
    const barLen = barLength(song.time);
    const styles = getComputedStyle(document.documentElement);
    const gold = styles.getPropertyValue('--gold').trim() || '#f0b54d';
    const lyrics = song.lyrics ?? [];

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr || c.height !== H * dpr) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const beat = transportState.beat.value;
      const pxPerBeat = Math.max(48, Math.min(110, W / 12));
      const headX = Math.min(220, W * 0.22);
      const padY = 14;
      const rows = hi - lo;
      const rowH = (H - padY * 2) / Math.max(1, rows);
      const y = (m: number) => padY + (hi - m) * rowH;
      const x = (b: number) => headX + (b - beat) * pxPerBeat;
      const inst = instrument.value;
      const r = root.value;

      // Bar lines and numbers.
      ctx.font = '11px Inter, sans-serif';
      const firstBar = Math.floor((beat - headX / pxPerBeat) / barLen);
      for (let b = Math.max(0, firstBar); x(b * barLen) < W; b++) {
        const bx = x(b * barLen);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, H);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(String(b + 1), bx + 4, 12);
      }

      // Notes.
      const curIdx = transportState.noteIndex.value;
      song.notes.forEach((n, i) => {
        if (n.midi === null) return;
        const x0 = x(n.start), x1 = x(n.start + n.dur);
        if (x1 < 0 || x0 > W) return;
        const yy = y(n.midi);
        const h = Math.max(14, Math.min(26, rowH * 1.6));
        const playable = !!inst.fingering(n.midi, r);
        const past = n.start + n.dur <= beat;
        const cur = i === curIdx;
        ctx.fillStyle = cur ? gold : past ? 'rgba(240,181,77,0.18)' : playable ? 'rgba(240,181,77,0.55)' : 'rgba(255,107,107,0.5)';
        roundRect(ctx, x0 + 1, yy - h / 2, Math.max(6, x1 - x0 - 2), h, 6);
        ctx.fill();
        if (x1 - x0 > 22) {
          ctx.fillStyle = cur ? '#2a1c05' : past ? 'rgba(255,255,255,0.35)' : '#1b1306';
          ctx.font = `${cur ? 700 : 600} 12px Inter, sans-serif`;
          ctx.fillText(label(n.midi, { octave: false }), x0 + 7, yy + 4);
        }
      });

      // Playhead.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(headX, 0);
      ctx.lineTo(headX, H);
      ctx.stroke();

      // Player's live note.
      const live = activeNote.value;
      if (live !== null && live >= lo - 6 && live <= hi + 6) {
        const want = curIdx >= 0 ? song.notes[curIdx].midi : null;
        const ok = want !== null && want === live;
        const ly = y(Math.max(lo, Math.min(hi, live)));
        ctx.fillStyle = ok ? '#5fd39a' : want === null ? '#e8edf1' : '#ff6b6b';
        ctx.beginPath();
        ctx.arc(headX, ly, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Count-in.
      if (beat < 0 && transportState.playing.value) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 40px Inter, sans-serif';
        ctx.fillText(String(Math.ceil(-beat)), headX + 20, H / 2 + 14);
      }

      // Lyrics under the lane.
      if (lyricRef.current && lyrics.length) {
        let text = '';
        for (const l of lyrics) if (l.start <= beat + 0.5) text = l.text;
        if (lyricRef.current.textContent !== text) lyricRef.current.textContent = text;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [song]);

  if (!song) return null;
  return (
    <div class="lane-wrap">
      <canvas ref={canvas} class="lane" />
      {song.lyrics?.length ? <div class="lane-lyrics" ref={lyricRef} /> : null}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
