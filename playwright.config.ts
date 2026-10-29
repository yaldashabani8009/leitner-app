import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (ADR-008, ADR-017, roadmap 7.14): the built app, service worker included,
 * in WebKit (closest to iPhone Safari) and Chromium (Android Chrome).
 * The cloud is an in-memory stand-in (src/e2e/fakeServices.ts), so no secrets are needed.
 * Run: npm run e2e  (CI installs the browsers; see .github/workflows/ci.yml)
 */
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // "github" turns each failure into an annotation on the PR (readable without the full log).
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/leitner-app/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/leitner-app/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
