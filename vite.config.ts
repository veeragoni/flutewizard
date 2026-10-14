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

export default defineConfig({
  base,
  plugins: [preact(), songRoutes()],
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
