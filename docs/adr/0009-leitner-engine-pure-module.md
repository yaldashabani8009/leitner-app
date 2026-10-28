# ADR-009: The Leitner engine is a pure, fully tested module

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
The scheduling rules (boxes, gaps, mastered, wrong → box 1, sessions, daily cap) are the heart of the app and must be correct.

## Options considered
1. **Pure functions in `src/domain/`**: input → output, no React/Dexie/Supabase imports, current date passed in. Easy to test, reusable in a future native app.
2. **Logic inside components/DB layer**: faster to start. Cons: hard to test, rules get scattered.

## Decision
**`src/domain/leitner/` contains only pure TypeScript.** "Today" is always passed in as a parameter (never `new Date()` inside). Gaps and limits live in `config.ts`.

## Consequences
- An ESLint boundary can forbid imports from `react`, `dexie`, `@supabase/*` in `src/domain` (to add in step 7).
- The UI and data layers call the engine; they never re-implement rules.
