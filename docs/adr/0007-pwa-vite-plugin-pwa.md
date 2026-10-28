# ADR-007: vite-plugin-pwa for offline and install

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The app must install to the home screen and open offline for 30+ days.

## Options considered

1. **vite-plugin-pwa (Workbox)**: generates manifest + service worker from config, precaches the build, free. Cons: one more plugin to understand.
2. **Hand-written service worker**: full control. Cons: easy to get caching/update bugs wrong.

## Decision

**vite-plugin-pwa** in `generateSW` mode, `registerType: 'autoUpdate'`, precaching all JS/CSS/HTML/fonts/icons, `navigateFallback: /index.html`. Fonts are self-hosted via `@fontsource` so they work offline.

## Consequences

- Updates arrive on the next online launch.
- Icons live in `public/icons/` (placeholder until the mascot icon is final).
- iOS: no install prompt; the user taps Share → Add to Home Screen.
