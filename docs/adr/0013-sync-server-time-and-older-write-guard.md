# ADR-013: Sync pulls by server time; the database refuses older writes

- **Status:** Accepted
- **Date:** 2026-10-28
- **Refines:** ADR-003 (outbox + last write wins)

## Context

ADR-003 said: pull rows with `updated_at > lastPulledAt`, and resolve conflicts by `updated_at`. Two cases break that, because `updated_at` is the device's clock at the time of the edit, not when the cloud received it:

1. **Missed edits.** The phone edits a card offline on Monday and uploads it on Friday. The laptop already pulled on Wednesday, so it asks "what changed since Wednesday?". The row still says Monday, so it is never pulled.
2. **Overwritten edits.** That Monday edit, arriving on Friday, would overwrite a newer edit already in the cloud, because an upsert simply replaces the row.

## Options considered

1. **Two database rules:** a `server_updated_at` column stamped by the server on every write (pulls use it), plus a trigger that skips any update whose `updated_at` is older than the stored one. Small schema change; only changed rows are downloaded.
2. **No schema change:** download everything on every sync and compare locally, and check the cloud before every upload. Cons: gets slower and uses more data as the box grows; bad on slow or restricted connections.

## Decision

**Option 1** (Yali's decision). Migration `20261028223906_sync_server_time.sql`:

- `server_updated_at timestamptz` on `cards`, `card_entries`, `review_logs`, always set by trigger `b_stamp_server_updated_at`, indexed with `(user_id, server_updated_at, id)`.
- Trigger `a_reject_older_write` on `cards` and `card_entries` silently skips an update with an older `updated_at` (same time is allowed, so re-sending is harmless).
- Devices pull per table by `(server_updated_at, id)` in pages of 1000, starting each pull 60 seconds before the saved position (re-reading is harmless; it guards against a slow write landing with a slightly earlier time).
- Duplicate word on two devices (both offline): the second upload hits `cards_user_word_unique`; that device merges its card into the cloud card. The cloud card keeps its box and due date, the lists are combined without repeats, and the review history moves over (Yali's decision).

## Consequences

- Last write wins still uses device clocks (accepted in ADR-003 for personal use).
- `server_updated_at` is never sent by the app; the server owns it.
- The pull position is stored per device in the Dexie `meta` table (database version 2).
