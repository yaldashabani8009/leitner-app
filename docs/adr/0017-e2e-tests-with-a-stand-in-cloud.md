# ADR-017: End-to-end tests run the real app with a stand-in cloud

- **Status:** Accepted
- **Date:** 2026-10-29
- **Builds on:** ADR-008 (Vitest + Playwright)

## Context

Roadmap 7.14: Playwright tests for three key flows (review a card, add a word, open offline), green in CI on WebKit (iPhone Safari) and Chromium (Android Chrome). The app signs in with Supabase and syncs to it. There is one Supabase project, the real one, on the free plan.

## Options considered

1. **Test against the real Supabase** with a test account: covers the real sign-in. Cons: CI needs a password as a secret; tests write into the real database; they fail when Supabase is slow or down; RLS means a second account and clean-up after every run.
2. **A test build with a stand-in cloud:** `vite build --mode e2e` swaps only the cloud side (sign-in, profile, sync) for an in-memory stand-in. Everything else is the real built app: service worker, IndexedDB, every screen. No secrets, nothing written to the real database, fast and repeatable. Cons: Supabase itself isn't exercised (its parts are covered by unit tests and by using the app).

## Decision

**Option 2** (decided by Claude while Yali delegated 7.14, 2026-10-29).

- `src/e2e/fakeServices.ts` provides the `AppServices` (the same seam unit tests use): one account (`yali@example.com` / `leitner-e2e`), the session kept in `localStorage`, a profile in Asia/Tehran, and `src/test/fakeCloud.ts` as the cloud. Like the real one, it fails while the browser is offline, so the offline start goes through the real "offline, open the last account" path (`startup.ts`).
- `main.tsx` loads it only when `import.meta.env.MODE === 'e2e'`; Vite drops that branch and file from the published site (checked: the production build contains no test code).
- `playwright.config.ts`: builds to `dist-e2e/`, serves it with `vite preview`, runs projects `iphone-webkit` (iPhone 13) and `android-chromium` (Pixel 7). Time is set with `page.clock.setFixedTime`, so "tomorrow" needs no waiting.
- Tests in `e2e/`: sign in → add words → review the next day (tap, keyboard, practice round, Session complete, streak, words learned); wrong password; duplicate word; open offline (the service worker must control the page, then the app opens, adds words and reviews with no connection).
- CI: an `e2e` job in `ci.yml` (every branch and PR) and in `deploy.yml`, where publishing now waits for it.

## Consequences

- A change that breaks a key flow in Safari's engine or Chrome can't reach the live site.
- Supabase sign-in, RLS and real sync are not covered by E2E; they rely on unit tests (fakes for the same interfaces) and the manual phone + laptop test (7.6).
- WebKit is only installed in CI; locally `npm run e2e -- --project=android-chromium` runs the Chromium half.
