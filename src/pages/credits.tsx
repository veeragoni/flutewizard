import { render } from 'preact';
import { PageShell } from './shell';
import '../styles.css';
import './pages.css';

function Credits() {
  return (
    <PageShell title="Credits & sources">
      <section class="article">
        <h2>Recordings</h2>
        <ul>
          <li><b>Bansuri:</b> recordings by <a href="https://freesound.org/people/sankalp/">sankalp</a> on Freesound (sounds 179693, 179694, 179695, 179696), licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Modified: sliced into single notes, trimmed, levelled, looped, pitch-corrected and re-encoded.</li>
          <li><b>Concert flute:</b> VS Chamber Orchestra: Community Edition by Versilian Studios and Ivy Audio (Sam Gossner, Simon Dalzell), <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>. <a href="https://vis.versilstudios.com/vsco-community.html">vis.versilstudios.com</a></li>
          <li><b>Recorder:</b> Versilian Community Sample Library by Versilian Studios, CC0.</li>
          <li><b>Tin whistle:</b> &ldquo;Waltons Irish ThinWhistle in D&rdquo; by <a href="https://freesound.org/people/cernoel/packs/22189/">cernoel</a> on Freesound, CC0.</li>
        </ul>
        <h2>Modelled sound</h2>
        <p>The flutes are also available as a physical model built for this app: an air jet striking an edge, driving a resonating tube, with breath turbulence, drift and vibrato. It is based on the waveguide flute model by Perry R. Cook (Synthesis ToolKit). The drone, tabla, drums, bass and strings are synthesized in the browser.</p>
        <h2>Fingering charts</h2>
        <ul>
          <li>Concert flute: The Woodwind Fingering Guide (wfg.woodwind.org) and fingercharts.com.</li>
          <li>Recorder: Dolmetsch Online text fingering chart, Yamaha soprano (Baroque) chart, The Woodwind Fingering Guide.</li>
          <li>Tin whistle: Grey Larsen&rsquo;s fingering chart with half-hole fingerings, The Woodwind Fingering Guide.</li>
          <li>Bansuri: David Philipson&rsquo;s chart (One World Flutes), sound-of-bansuri.com, flutesangam.com.</li>
        </ul>
        <h2>Songs</h2>
        <p>All built-in tunes are traditional or by composers in the public domain, transcribed for this app. Songs you write or import stay in your browser.</p>
      </section>
    </PageShell>
  );
}

render(<Credits />, document.getElementById('app')!);
