import type { ComponentChildren } from 'preact';
import { Logo } from '../ui/Logo';
import { at } from '../base';

/** Header and footer shared by the tuner, chart and song pages. */
export function PageShell({ title, intro, children }: { title: string; intro?: string; children: ComponentChildren }) {
  return (
    <div class="page">
      <header class="topbar page-top">
        <a class="brand" href={at('/')}>
          <Logo />
          <span><b>Flutely</b><small>Online Virtual Flute</small></span>
        </a>
        <nav class="page-nav">
          <a href={at('/')}>Play</a>
          <a href={at('/songs/')}>Songs</a>
          <a href={at('/fingering-charts/')}>Fingering charts</a>
          <a href={at('/tuner/')}>Tuner</a>
        </nav>
        <a class="primary-btn" href={at('/')}>Play the flute</a>
      </header>
      <main class="page-main">
        <h1>{title}</h1>
        {intro && <p class="lead">{intro}</p>}
        {children}
      </main>
      <footer class="page-foot">
        <div>
          <b>Play</b>
          <a href={at('/')}>Virtual flute</a>
          <a href={at('/?i=bansuri')}>Virtual bansuri</a>
          <a href={at('/?i=recorder')}>Virtual recorder</a>
          <a href={at('/?i=whistle')}>Virtual tin whistle</a>
        </div>
        <div>
          <b>Learn</b>
          <a href={at('/fingering-charts/')}>Fingering charts</a>
          <a href={at('/songs/')}>Easy flute songs</a>
          <a href={at('/tuner/')}>Flute tuner</a>
          <a href={at('/tuner/?i=bansuri')}>Bansuri tuner</a>
        </div>
        <div>
          <b>About</b>
          <a href={at('/credits/')}>Credits &amp; sources</a>
          <span class="muted">Free, no account. Your songs stay in your browser.</span>
        </div>
      </footer>
    </div>
  );
}
