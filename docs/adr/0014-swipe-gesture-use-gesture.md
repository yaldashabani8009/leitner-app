# ADR-014: Swipe gesture with @use-gesture/react

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

On the card back you answer by swiping: right = "Knew it", left = "Not yet" (PRD user flow 5). The card has to follow the finger, tilt, show a stamp, and answer when released past about 30% of its width, on iPhone Safari and Android Chrome. The card back can also scroll up and down, so a horizontal swipe must not block vertical scrolling. Swiping is off on the card front.

## Options considered

1. **Hand-written pointer events**: no dependency, full control. Cons: we would handle the edge cases ourselves (pointer capture, taps vs drags, axis locking, cancelled touches, velocity).
2. **@use-gesture/react** (MIT, free, ~10 kB): handles taps vs drags, horizontal axis lock and velocity in one hook. Cons: one more dependency; the last release (10.3.1) is from 2024, but the library is small and stable and works with React 19.

## Decision

**Use `@use-gesture/react` (`useDrag`) for the card swipe.** Yali's decision (roadmap 7.9). The drawing and the answer logic stay ours (`src/screens/Review/useSwipe.ts`); only gesture detection comes from the library.

## Consequences

- One place uses the library: `useSwipe.ts`. Swapping it for hand-written code later only touches that file.
- The card back uses `touch-action: pan-y`, so vertical scrolling keeps working while horizontal drags are swipes.
- The "Knew it!" / "Not yet" buttons stay as the always-available backup (and the only way with a keyboard or screen reader).
