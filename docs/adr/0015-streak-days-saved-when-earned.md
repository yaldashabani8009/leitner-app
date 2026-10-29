# ADR-015: Streak days are saved the moment they are earned

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

The PRD streak rule (decided 2026-10-28) counts a day when any one is true:

1. 20 scheduled reviews were done that day;
2. fewer than 20 cards were due, and all of them were reviewed;
3. no cards were due at all, and a new word was added.

Rule 1 can be worked out later from the review logs. Rules 2 and 3 depend on **how many cards were due that day**, and the app keeps no record of that once the day is over: due dates move with every answer, and the duplicate-word rule moves a card back to box 1 without a review log. The roadmap had said "calculated from review logs", which can't work for past days.

## Options considered

1. **Save each earned day:** when today first meets the rule, store a "streak day" row; it syncs like review logs. Exact rule, phone and laptop agree. Cost: a new small cloud table.
2. **Rebuild past days from history:** replay every card's schedule to guess what was due each day. No schema change, but fragile: the duplicate rule and edits leave no trace, so past days can come out wrong.
3. **Past days by rule 1 only:** simple, no schema change, but a day earned with 8 due cards would later drop out of the streak, which breaks the rule.

## Decision

**Option 1** (Yali's decision, 2026-10-29).

- Cloud table `streak_days` (migration `20261029124503_streak_days.sql`): `id`, `user_id`, `day` (calendar date in the profile time zone), `created_at`, `server_updated_at`. Unique `(user_id, day)`. RLS: read + insert own rows only (append-only, like `review_logs`).
- Device: Dexie version 3 adds `streakDays` keyed by `day`. The repository checks the rule inside the same transaction as a scheduled answer or a new word, and saves + queues the day once.
- Sync pushes streak days last and pulls them like the other tables. A day earned on two devices is kept once: the upload uses `on conflict (user_id, day) do nothing`, and a device keeps its own row for a day it already has.
- The streak = earned days in a row ending today, or ending yesterday while today isn't earned yet (Yali's decision, 2026-10-29). Pure logic in `src/domain/progress/`.
- Words learned stays a pure count from review logs (cards with a scheduled "Knew it!" in box 1); Dexie version 3 indexes `boxBefore` so only box-1 logs are read.

## Consequences

- An earned day is never removed, even if the rule's inputs change later (for example, a card edited on another device).
- Days before this change (before 2026-10-29) have no rows, so every streak starts from 7.11.
- Edge case: if the 20 reviews of rule 1 are split across two devices that haven't synced yet, neither device sees 20 at the time. The next scheduled answer or new word after a sync saves the day.
- A time-zone change in the profile does not move days that were already saved.
