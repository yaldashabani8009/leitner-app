# ADR-003: Sync with an outbox, last write wins, append-only logs

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

Cards are created, edited and reviewed offline (possibly for 30+ days) on several devices, then synced to Supabase. We need a simple, debuggable rule for conflicts.

## Options considered

1. **Hand-written outbox + last write wins (LWW) by `updated_at`**: simple, ~100–200 lines, easy to test. Cons: if the same card is edited on two devices offline, the older edit is lost (acceptable for one person).
2. **CRDTs / field-level merge**: no lost edits. Cons: far more complex; overkill.
3. **RxDB replication**: rejected in ADR-002.

## Decision

- Every local write also adds an entry to an **outbox** table in Dexie.
- **Push:** when online, send outbox rows to Supabase with `upsert`; clear them on success.
- **Pull:** fetch rows with `updated_at > lastPulledAt` and apply them locally if newer than the local row.
- **Conflicts:** last write wins by `updated_at` (UTC).
- **Deletes:** soft delete (`deleted_at`) so they sync.
- **review_logs:** append-only. Never updated, so they can't conflict.
- IDs are UUIDs created on the device.

## Consequences

- Sync is a pure-ish module with unit tests for the merge rules.
- An expired session never blocks local use; the outbox just waits.
- Device clocks matter for LWW; acceptable for personal use, revisit if multi-device teams appear.
