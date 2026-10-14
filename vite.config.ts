import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  plugins: [preact()],
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
