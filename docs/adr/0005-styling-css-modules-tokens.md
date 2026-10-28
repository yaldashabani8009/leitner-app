# ADR-005: CSS Modules + design tokens + Stylelint

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The design is custom and playful (2.5px ink outlines, hard bottom shadows, 40px radii), not standard UI. The designer will maintain styles. Design values must have one source of truth.

## Options considered

1. **CSS Modules + tokens as CSS variables**: plain CSS, scoped per component, readable, tokens mirror the palette exactly. Cons: two files per component; slower to write than utilities.
2. **Tailwind**: fast and AI-friendly. Cons: our custom look needs many arbitrary values (`border-[2.5px]`), making markup long and hard to review.

## Decision

**CSS Modules** for component styles, **`src/styles/tokens.css`** for all design values, and **Stylelint** with `declaration-strict-value` so raw colours, radii, shadows and font families outside `tokens.css` fail the build.

## Consequences

- Changing a colour = one line in `tokens.css`.
- Class names are camelCase (`styles.cardStack`).
- CI rejects hard-coded design values.
