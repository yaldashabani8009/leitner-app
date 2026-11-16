# ADR-023: Automatic streak freeze

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

One missed day reset the streak to 0 (decided 2026-10-29). After weeks of use Yali asked for a one-day freeze, "an automatic thing": once a week is fine, and 4 days in a row of practice can bring it back sooner.

## Options considered

1. **A stored freeze counter** (in the profile, synced): the freeze state lives in the database and has to be kept right on every device.
2. **Worked out from the earned days alone:** the streak days are already synced (ADR-015); the freeze can be replayed from them, like the streak itself.

## Decision

Option 2, in `streakState` (`src/domain/progress/progress.ts`), with `STREAK_FREEZE_REFILL_DAYS = 7` and `STREAK_FREEZE_REFILL_RUN = 4` in `config.ts`.

- There is one freeze, ready at the start.
- A single missed day is covered automatically when the freeze is ready: the run goes on, and the frozen day isn't counted in the number.
- Two missed days in a row still end the run, and the freeze isn't spent on them.
- A used freeze is ready again 7 days after the day it covered, or as soon as there are 4 earned days in a row after it.
- Today never breaks anything (unchanged): until it is earned, the streak shows the run up to yesterday.

## Consequences

- No database change and no sync work; every device gets the same answer from the same streak days.
- The server reminder uses the same function, so its "your 5-day streak" matches the app (the reminder functions are redeployed).
- Nothing is shown about the freeze yet; a small sign that it was used or is ready can come later if Yali wants it.
