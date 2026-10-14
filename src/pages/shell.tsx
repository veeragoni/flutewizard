import type { ComponentChildren } from 'preact';
import { Logo } from '../ui/App';

/** Header and footer shared by the tuner, chart and song pages. */
export function PageShell({ title, intro, children }: { title: string; intro?: string; children: ComponentChildren }) {
  return (
    <div class="page">
      <header class="topbar page-top">
        <a class="brand" href="/">
          <Logo />
          <span><b>Flutely</b><small>Online Virtual Flute</small></span>
        </a>
        <nav class="page-nav">
          <a href="/">Play</a>
          <a href="/songs/">Songs</a>
          <a href="/fingering-charts/">Fingering charts</a>
          <a href="/tuner/">Tuner</a>
        </nav>
        <a class="primary-btn" href="/">Play the flute</a>
      </header>
      <main class="page-main">
        <h1>{title}</h1>
        {intro && <p class="lead">{intro}</p>}
        {children}
      </main>
      <footer class="page-foot">
        <div>
          <b>Play</b>
          <a href="/">Virtual flute</a>
          <a href="/?i=bansuri">Virtual bansuri</a>
          <a href="/?i=recorder">Virtual recorder</a>
          <a href="/?i=whistle">Virtual tin whistle</a>
        </div>
        <div>
          <b>Learn</b>
          <a href="/fingering-charts/">Fingering charts</a>
          <a href="/songs/">Easy flute songs</a>
          <a href="/tuner/">Flute tuner</a>
          <a href="/tuner/?i=bansuri">Bansuri tuner</a>
        </div>
        <div>
          <b>About</b>
          <a href="/credits/">Credits &amp; sources</a>
          <span class="muted">Free, no account. Your songs stay in your browser.</span>
        </div>
      </footer>
    </div>
  );
}
