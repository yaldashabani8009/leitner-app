import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke check of the published site, run by deploy.yml after every deploy (roadmap step 8).
 * Run by hand: npx playwright test -c playwright.live.config.ts
 */
export default defineConfig({
  testDir: 'smoke',
  retries: 2, // GitHub Pages can take a moment to serve a fresh deploy
  // "github" turns each failure into an annotation on the run (readable without the full log).
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'https://yaldashabani8009.github.io/leitner-app/' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
