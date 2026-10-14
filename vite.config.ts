import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;
// Served from a sub-folder on GitHub Pages: BASE=/flutewizard/ npm run build
const base = process.env.BASE ?? '/';

/** In development, song pages like /songs/twinkle/bansuri/ use the songs page (the build writes real files). */
function songRoutes(): Plugin {
  return {
    name: 'song-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const prefix = base + 'songs/';
        if (req.url && req.url.startsWith(prefix) && /^[a-z0-9-]+\/([a-z]+\/)?(\?.*)?$/.test(req.url.slice(prefix.length))) {
          req.url = prefix + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
        }
        next();
      });
    },
  };
}

/**
 * Cloudflare Web Analytics (page views, referrers, countries; no cookies) on every page of the
 * production build, when CF_BEACON_TOKEN is set (a GitHub repository variable in the deploy workflow).
 */
function cloudflareAnalytics(): Plugin {
  const token = process.env.CF_BEACON_TOKEN?.trim();
  return {
    name: 'cloudflare-analytics',
    apply: 'build',
    transformIndexHtml(html) {
      if (!token || !/^[\w-]+$/.test(token)) return html;
      return html.replace('</body>', `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>\n  </body>`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [preact(), songRoutes(), cloudflareAnalytics()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        tuner: resolve(root, 'tuner/index.html'),
        fingerings: resolve(root, 'fingering-charts/index.html'),
        songs: resolve(root, 'songs/index.html'),
        credits: resolve(root, 'credits/index.html'),
      },
    },
  },
});
