import { panel, prefs, setPrefs, songsTab, editorSongId, type Panel } from '../state';
import { IconChart, IconClose, IconEdit, IconHelp, IconMic, IconMusic, IconTuner } from './icons';

export function MainMenu() {
  if (panel.value !== 'help') return null;
  const p = prefs.value;
  const go = (to: Panel) => (panel.value = to);
  return (
    <div class="menu-sheet" role="menu">
      <div class="drawer-head">
        <h3>Menu</h3>
        <button class="icon-btn plain" onClick={() => go(null)} aria-label="Close"><IconClose size={18} /></button>
      </div>
      <nav class="menu-links">
        <button onClick={() => { songsTab.value = 'library'; go('songs'); }}><IconMusic size={18} /> Songs &amp; recordings</button>
        <button onClick={() => { editorSongId.value = null; go('editor'); }}><IconEdit size={18} /> Write or import a song</button>
        <button onClick={() => go('own')}><IconMic size={18} /> Record your own flute</button>
        <a href="/tuner/"><IconTuner size={18} /> Flute tuner</a>
        <a href="/fingering-charts/"><IconChart size={18} /> Fingering charts</a>
        <a href="/songs/"><IconMusic size={18} /> Song library</a>
      </nav>
      <div class="menu-section">
        <h4>Settings</h4>
        <label class="field-row">
          <span>Note names</span>
          <select value={p.naming} onChange={(e) => setPrefs({ naming: (e.target as HTMLSelectElement).value as typeof p.naming })}>
            <option value="auto">Auto (Sargam on bansuri)</option>
            <option value="western">Letters (C D E)</option>
            <option value="sargam">Sargam (Sa Re Ga)</option>
          </select>
        </label>
        <label class="field-row">
          <span>Tuner reference A4</span>
          <input type="number" min={415} max={466} value={p.a4} onChange={(e) => setPrefs({ a4: Number((e.target as HTMLInputElement).value) || 440 })} style={{ width: '84px' }} />
        </label>
        <label class="check">
          <input type="checkbox" checked={p.showKeyboard} onChange={(e) => setPrefs({ showKeyboard: (e.target as HTMLInputElement).checked })} />
          Show the on-screen keyboard
        </label>
      </div>
      <div class="menu-section">
        <h4><IconHelp size={16} /> How to play</h4>
        <ul class="help-list">
          <li><b>Keyboard mode:</b> the three letter rows are three octaves of the scale. <kbd>Shift</kbd> gives komal/tivra (or sharps). Hold <kbd>Space</kbd> for vibrato, <kbd>←</kbd>/<kbd>→</kbd> to bend (meend), <kbd>↑</kbd>/<kbd>↓</kbd> to change octave.</li>
          <li><b>Fingers mode:</b> play it like the real flute. <kbd>F</kbd><kbd>D</kbd><kbd>S</kbd> are your top-hand fingers, <kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> the bottom hand. The key above half-covers. Hold <kbd>Space</kbd> to blow, <kbd>Shift</kbd> to overblow.</li>
          <li><b>My flute:</b> play your real flute near the microphone. The app shows the note and fingering, and "Wait for me" moves on when you play the right note.</li>
          <li><b>Songs:</b> Listen first, then Play along. Slow the tempo down while learning.</li>
        </ul>
      </div>
    </div>
  );
}
