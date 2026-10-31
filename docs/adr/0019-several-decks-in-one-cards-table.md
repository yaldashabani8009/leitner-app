# ADR-019: Several decks in one cards table

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

v3 adds more study areas (vocab now; spelling and phrases later; grammar maybe). They all use the same Leitner boxes, and the same word may be learned in more than one area, each with its own progress.

## Options considered

1. **One table per deck**: clean separation, but every query, sync mapping, backup and screen is repeated per deck.
2. **One `cards` table with a `deck` field**: one engine, one sync path, one backup; a deck is just a filter.

## Decision

Option 2. `cards.deck` is `vocab | spelling | phrases` (existing cards become `vocab`). The duplicate rule becomes one card per word **per deck**. Session size and daily limit are per deck (`DECK_LIMITS` in `src/domain/leitner/config.ts`); the boxes and gaps are the same for all. Decks come from a registry (`src/domain/decks`) with an `enabled` flag, so screens loop over `enabledDecks()` and a new area plugs in by adding an entry; only `vocab` is enabled for now. The streak is shared: `studiedToday` adds up every area and `dayCountsForStreak` decides. Spelling review logs get a nullable `typed_answer` now, so no second migration is needed later.

## Consequences

- Everything must work with one or with all three decks enabled; tests use fixtures with all enabled.
- Old data without a deck (cloud rows, v1 backups) is read as `vocab` (`deckOrVocab`).
- Cross-deck features (Mix them all, box badge, reminders) count over all decks and filter by `deck` where needed.
