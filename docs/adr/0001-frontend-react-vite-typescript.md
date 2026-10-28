# ADR-001: React + Vite + TypeScript

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

We need a UI framework that keeps the screen in sync with state (card flipped, progress, mascot mood). The developer is a designer who relies on AI-assisted coding, so ecosystem, examples and AI code quality matter as much as raw features. The hard parts are local-first data, swipe gestures and lots of playful motion.

## Options considered

1. **React**: largest ecosystem (Framer Motion, Dexie hooks, gesture libraries), best AI/Cursor/Claude Code output, most answers online. Cons: more ceremony (hooks rules; `useEffect` is a common bug source); animation and styling come from libraries.
2. **Svelte 5**: least code, built-in transitions, tiny bundles. Cons: smaller ecosystem; recent syntax change means AI tools often mix old and new styles.
3. **Vue 3**: gentle learning curve, official router/state. Cons: smaller ecosystem and less AI training data than React; two component styles (Options vs Composition) confuse examples.

## Decision

**React 19 + TypeScript (strict), built with Vite.**

## Consequences

- Biggest choice of free libraries; most reliable AI-generated code.
- We must follow hook rules (ESLint `react-hooks` plugin enforces them).
- Prefer derived state and Dexie live queries over `useEffect` for data.
