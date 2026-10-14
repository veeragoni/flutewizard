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
      meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
    ].filter(Boolean).join('\n    ');
    html = html.replace('</head>', `    ${head}\n  </head>`);
    const out = resolve(dist, meta.path, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    urls.push(meta.path);
  }
  urls.push('tuner/', 'fingering-charts/', 'credits/');

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
