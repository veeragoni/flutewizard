import { useState } from 'preact/hooks';
import { transport, transportState } from '../audio/transport';
import { barCount, barLength, songLength } from '../music/song';
import { closeSong, togglePlay } from '../songs/actions';
import { currentSong, editorSongId, loopOn, panel, prefs, setPrefs, tempoBpm, userTranspose, songsTab } from '../state';
import { IconChevron, IconClose, IconDrum, IconEdit, IconLoop, IconMusic, IconPause, IconPlay, IconStop } from './icons';
import { keyLabel as songKeyLabel } from '../music/theory';

export function TransportBar() {
  const song = currentSong.value;
  const p = prefs.value;
  if (!song) {
    return (
      <div class="transport empty">
        <button class="primary-btn" onClick={() => { songsTab.value = 'library'; panel.value = 'songs'; }}>
          <IconMusic size={18} /> Songs &amp; recordings
        </button>
        <button class="ghost-btn" onClick={() => { editorSongId.value = null; panel.value = 'editor'; }}>
          <IconEdit size={18} /> Write or import a song
        </button>
      </div>
    );
  }
  const playing = transportState.playing.value;
  const beat = transportState.beat.value;
  const bars = barCount(song);
  const barLen = barLength(song.time);
  const bar = beat < 0 ? 0 : Math.min(bars, Math.floor(beat / barLen) + 1);
  const total = songLength(song);
  const pct = Math.max(0, Math.min(1, beat / total));
  const hits = transportState.hits.value, misses = transportState.misses.value;

  return (
    <div class="transport">
      <button class="song-chip" onClick={() => { songsTab.value = song.builtin ? 'library' : 'mine'; panel.value = 'songs'; }}>
        <span class="chip-icon"><IconMusic size={16} /></span>
        <span class="chip-text">
          <b>{song.title}</b>
          {song.artist && <small>{song.artist}</small>}
        </span>
        <IconChevron size={16} />
      </button>
      <button class="icon-btn small" onClick={closeSong} aria-label="Close song"><IconClose size={16} /></button>

      <div class="transport-main">
        <div class="transport-row">
          <button class="play-btn" onClick={togglePlay}>
            {playing ? <IconPause size={18} /> : <IconPlay size={18} />} {playing ? 'Pause' : 'Play'}
          </button>
          <button class="icon-btn" onClick={() => transport.stop()} aria-label="Stop"><IconStop size={18} /></button>
          <TempoControl bpm={song.bpm} />
          <div class="seg mode-seg">
            <button class={p.playMode === 'listen' ? 'on' : ''} onClick={() => setPrefs({ playMode: 'listen' })} title="The flute plays it for you">Listen</button>
            <button class={p.playMode === 'along' ? 'on' : ''} onClick={() => setPrefs({ playMode: 'along' })} title="Play with the music; your notes are scored">Play along</button>
            <button class={p.playMode === 'wait' ? 'on' : ''} onClick={() => setPrefs({ playMode: 'wait' })} title="The music waits until you play each note">Wait for me</button>
          </div>
          <label class="toggle" title="Backing band: drums, bass and strings">
            <IconDrum size={18} /> Band
            <input type="checkbox" checked={p.bandOn} onChange={(e) => setPrefs({ bandOn: (e.target as HTMLInputElement).checked })} />
            <span class="switch" />
          </label>
          <button class="icon-btn small" onClick={() => (panel.value = panel.value === 'band' ? null : 'band')} aria-label="Band settings"><IconEdit size={16} /></button>
          <button
            class={'icon-btn small' + (loopOn.value ? ' on' : '')}
            onClick={() => (loopOn.value = !loopOn.value)}
            aria-label="Loop"
            title="Loop the song"
          >
            <IconLoop size={16} />
          </button>
          <Transpose />
        </div>
        <div class="progress-row">
          <span class="bar-count">BAR {bar}/{bars}</span>
          <div
            class="progress"
            onPointerDown={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
              transport.seek(Math.floor((frac * total) / barLen) * barLen);
            }}
          >
            <div class="progress-fill" style={{ width: `${pct * 100}%` }} />
            {Array.from({ length: Math.min(bars, 120) }, (_, i) => (
              <span class="tick" style={{ left: `${((i * barLen) / total) * 100}%` }} />
            ))}
          </div>
          <span class="meta">
            {songKeyLabel(song.tonic, song.mode)} · {song.time[0]}/{song.time[1]}
          </span>
          {p.playMode !== 'listen' && hits + misses > 0 && (
            <span class="score" title="Notes you played right">{Math.round((hits / (hits + misses)) * 100)}% · {hits}/{hits + misses}</span>
          )}
          {transportState.waiting.value && <span class="waiting">Waiting for you…</span>}
        </div>
      </div>
      <button class="ghost-btn small" onClick={() => { editorSongId.value = song.id; panel.value = 'editor'; }}>
        <IconEdit size={16} /> Edit
      </button>
      <button class="ghost-btn small" onClick={() => (panel.value = panel.value === 'sheet' ? null : 'sheet')}>Notes</button>
    </div>
  );
}

function TempoControl({ bpm }: { bpm: number }) {
  const [open, setOpen] = useState(false);
  const t = tempoBpm.value;
  const pct = Math.round((t / bpm) * 100);
  return (
    <div class="tempo">
      <button class="tempo-btn" onClick={() => setOpen(!open)}>
        Tempo: <b>{Math.round(t)}</b> <small>BPM</small> {pct !== 100 && <small class="pct">{pct}%</small>} <IconChevron size={14} />
      </button>
      {open && (
        <div class="popover" onPointerLeave={() => setOpen(false)}>
          <input
            type="range" min={Math.max(10, Math.round(bpm * 0.2))} max={Math.min(260, Math.round(bpm * 1.5))} value={t}
            onInput={(e) => (tempoBpm.value = Number((e.target as HTMLInputElement).value))}
          />
          <div class="pop-row">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <button class={'chip' + (pct === f * 100 ? ' on' : '')} onClick={() => (tempoBpm.value = Math.round(bpm * f))}>{f * 100}%</button>
            ))}
          </div>
          <small class="muted">Slow it down to learn, then build up to full speed.</small>
        </div>
      )}
    </div>
  );
}

function Transpose() {
  const v = userTranspose.value;
  return (
    <div class="transpose" title="Move the song up or down (semitones)">
      <button class="icon-btn tiny" onClick={() => (userTranspose.value = v - 1)}>−</button>
      <span>{v > 0 ? '+' : ''}{v}</span>
      <button class="icon-btn tiny" onClick={() => (userTranspose.value = v + 1)}>+</button>
    </div>
  );
}
