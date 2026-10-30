import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page setup: every HTML page is its own entry point.
export default defineConfig({
  build: {
    // three.js is lazy-loaded only on pages with a 3D hero, so a larger chunk is expected
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        jee: resolve(import.meta.dirname, 'jee.html'),
        neet: resolve(import.meta.dirname, 'neet.html'),
        school: resolve(import.meta.dirname, 'school.html'),
        sitemap: resolve(import.meta.dirname, 'sitemap.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
