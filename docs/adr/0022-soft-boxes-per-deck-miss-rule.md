# ADR-022: Soft boxes: a miss rule per deck

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

Phrases (v3 step 6) are learned more slowly than single words, and sending a well-known phrase all the way back to box 1 after one slip felt too harsh (Yali and Claude, brief `HANDOFF-v3-steps4-6.md` §1.5). Vocab and Spelling keep the classic Leitner rule.

## Options considered

1. **A special engine or screen for phrases:** duplicated logic, easy to drift.
2. **One engine with a per-deck miss rule:** the engine takes the rule as a parameter; the deck table in `config.ts` says which rule each deck uses.

## Decision

Option 2.

- `src/domain/leitner/config.ts`: `MissRule = 'reset' | 'stepBack'` and `DECK_MISS_RULE = { vocab: 'reset', spelling: 'reset', phrases: 'stepBack' }`.
- `answer(card, correct, today, now, missRule = 'reset')` in `engine.ts`:
  - `reset`: a miss → box 1, due tomorrow, from any box (unchanged);
  - `stepBack`: a miss → one box down, never below box 1, due today + that box's gap (box 3 → box 2, due in 2 days). It never goes back to the start.
- Right answers are the same for every deck. The repository passes the card's deck rule; the review log records `box_after` as usual.

## Consequences

- No database change (`box_after` already allows 1–5).
- "Needs work", the streak and the reminders treat a phrase miss like any other miss.
- A new deck only needs a line in `DECK_MISS_RULE`.
