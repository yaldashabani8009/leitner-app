# ADR-020: Reminder time per user and next-reminder index

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

ADR-018 sent every reminder from 19:00 in the profile time zone: every 15 minutes the cron job read **every** device and checked the hour in code. v3 lets each person choose their time (Settings, canvas N13, 15-minute steps, default 19:00) and switch reminders off. Reading every row each quarter hour also grows with the number of devices.

## Options considered

1. **Keep scanning every row** and compare each user's time in code: simple, but the work grows with every device, all day.
2. **Store the next moment to remind on each device** (`push_subscriptions.next_reminder_at`, indexed) and let the cron read only rows where it has passed: a small indexed read; the time zone maths lives in one SQL function.

## Decision

Option 2.

- `profiles.reminder_time` (default `19:00`) and `profiles.reminders_on` (default `true`).
- `public.next_reminder_at(tz, at_time, reminders_on, after)`: today at that time in that zone if still ahead, else tomorrow; null when reminders are off. Tested in SQL across a DST change.
- Triggers keep it right: changing the time, switching on/off or a new time zone recomputes it for all the user's devices; a newly saved device gets its first one.
- The cron job (still every 15 minutes) reads only rows with `next_reminder_at <= now()`, sends if there is something to do, then sets the next one: tomorrow at the user's time. A reminder more than 4 hours late (the server was paused) is skipped, not sent at night.
- The text counts cards **across all decks**, each within its daily limit: "20 cards waiting · mostly spelling" (the deck is named only when more than one is enabled). The streak-saver text stays. The app icon badge is the same total.

## Consequences

- The app saves the settings straight to the cloud profile; offline, the Settings sheet says it can't reach the account and changes nothing.
- No time-zone setting: it follows the profile.
- `last_reminded_on` is still written, but no longer decides anything.
