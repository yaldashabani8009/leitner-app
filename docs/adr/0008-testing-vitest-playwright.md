# ADR-008: Vitest for unit tests, Playwright for end-to-end

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
The scheduling and sync rules must never silently break. The developer relies on AI-written code, so tests are the safety net.

## Options considered
1. **Vitest + Playwright**: Vitest shares Vite's config and is fast; Playwright drives real browsers, including WebKit (close to iPhone Safari). Both free.
2. **Jest + Cypress**: mature. Cons: extra config with Vite; Cypress has no WebKit.

## Decision
- **Vitest** for the Leitner engine, session builder, date/time-zone logic and sync merge rules. Target: 100% branch coverage of `src/domain`.
- **Playwright** (added in step 7) for a few key flows: review a card, add a word, offline launch.
- `fake-indexeddb` for testing Dexie code in Node.

## Consequences
- `npm run check` = typecheck + lint + CSS lint + tests + build; CI runs it on every push.
- Rule of thumb: every bug fix starts with a failing test.
