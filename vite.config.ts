/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// ADR-011: hosted on GitHub Pages at https://yaldashabani8009.github.io/leitner-app/
// so every URL lives under this sub-folder. Change BASE (and nothing else) when moving hosts.
const BASE = '/leitner-app/';

// ADR-007: vite-plugin-pwa generates the service worker + manifest.
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Leitner',
        short_name: 'Leitner',
        description: 'A playful Leitner flashcard box for English vocabulary.',
        theme_color: '#FFF3E4',
        background_color: '#FFF3E4',
        display: 'standalone',
        orientation: 'portrait',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the whole app shell (incl. fonts) so it opens offline for 30+ days.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { include: ['src/domain/**'], reporter: ['text', 'html'] },
  },
});
