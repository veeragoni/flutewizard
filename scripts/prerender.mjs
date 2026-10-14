// Writes a real HTML page for every song and flute (plus the song list), a sitemap and robots.txt,
// so search engines see the notes without running JavaScript. Runs after `vite build`.
//   SITE_URL=https://example.com/flutewizard/ BASE=/flutewizard/ node scripts/prerender.mjs
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const site = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');
const hasSite = site !== '/';
/** Share preview image (needs an absolute address, so only with SITE_URL). */
const socialImage = () => hasSite
  ? [`<meta property="og:image" content="${site}og.png" />`, '<meta property="og:image:width" content="1200" />', '<meta property="og:image:height" content="630" />', '<meta name="twitter:card" content="summary_large_image" />']
  : [];

const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { renderToString } = await import('preact-render-to-string');
  const { h } = await import('preact');
  const view = await server.ssrLoadModule('/src/pages/songsView.tsx');
  const template = readFileSync(resolve(dist, 'songs/index.html'), 'utf8');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const urls = [''];

  for (const route of view.allRoutes()) {
    const meta = view.pageMeta(route);
    const body = renderToString(h(view.SongsView, { route }));
    let html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(meta.description)}" />`)
      .replace('<div id="app"></div>', `<div id="app">${body}</div>`);
    const head = [
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:type" content="website" />`,
      hasSite ? `<link rel="canonical" href="${site}${meta.path}" />` : '',
      hasSite ? `<meta property="og:url" content="${site}${meta.path}" />` : '',
      ...socialImage(),
      meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
    ].filter(Boolean).join('\n    ');
    html = html.replace('</head>', `    ${head}\n  </head>`);
    const out = resolve(dist, meta.path, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    urls.push(meta.path);
  }
  urls.push('tuner/', 'fingering-charts/', 'credits/');

  // The other pages: canonical link and share previews from their own title and description.
  for (const path of ['', 'tuner/', 'fingering-charts/', 'credits/']) {
    const file = resolve(dist, path, 'index.html');
    let html = readFileSync(file, 'utf8');
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'Flute Wizard';
    const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
    const head = [
      `<meta property="og:title" content="${title}" />`,
      desc && `<meta property="og:description" content="${desc}" />`,
      `<meta property="og:type" content="website" />`,
      hasSite ? `<link rel="canonical" href="${site}${path}" />` : '',
      hasSite ? `<meta property="og:url" content="${site}${path}" />` : '',
      ...socialImage(),
    ].filter(Boolean).join('\n    ');
    html = html.replace('</head>', `    ${head}\n  </head>`);
    writeFileSync(file, html);
  }

  // GitHub Pages serves 404.html for any missing address.
  const base = process.env.BASE ?? '/';
  writeFileSync(resolve(dist, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Page not found | Flute Wizard</title><meta name="robots" content="noindex" /><link rel="icon" href="${base}favicon.svg" type="image/svg+xml" />
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111317;color:#e9e6df;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:16px}
a{color:#f0b54d}h1{font-size:28px;margin:0 0 8px}p{color:#a39f97;margin:0 0 20px}</style></head>
<body><main><h1>That page isn’t here</h1><p>It may have moved. Try the virtual flute or the song library.</p>
<p><a href="${base}">Play the flute</a> · <a href="${base}songs/">Songs</a> · <a href="${base}fingering-charts/">Fingering charts</a> · <a href="${base}tuner/">Tuner</a></p></main></body></html>
`);

  if (hasSite) {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(urls)].map((u) => `  <url><loc>${site}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
  }
  writeFileSync(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n${hasSite ? `Sitemap: ${site}sitemap.xml\n` : ''}`);
  console.log(`prerendered ${urls.length - 4} song pages${hasSite ? ' + sitemap.xml' : ' (set SITE_URL for canonical links and a sitemap)'}`);
} finally {
  await server.close();
}
