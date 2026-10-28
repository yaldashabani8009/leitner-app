# ADR-012: One on-device database per account

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The app is multi-user ready (ADR-010), and more than one person could sign in on the same phone or laptop. Cards, entries and review logs are stored on the device first (ADR-002), and may sit unsynced for 30+ days. Local rows carry no `user_id` (Supabase fills it in from the signed-in user), so accounts must never share a local database.

## Options considered

1. **A separate Dexie database per account** (`leitner-<userId>`): accounts can never mix, and signing back in (even offline) finds your cards again. Cons: a little more storage when several people share a device.
2. **One database, wiped at sign-out**: least storage. Cons: signing out with unsynced offline changes would lose them.

## Decision

**Each account gets its own on-device database, named `leitner-<userId>`** (`openDatabase(userId)` in `src/data/db.ts`). Yali's decision.

## Consequences

- The app opens the database only after it knows who is signed in (roadmap 7.5).
- Signing out never deletes local data. If wiping a device is ever wanted, it needs its own explicit action.
- Each database holds a single `profile` row (name and time zone), so "today" works offline.
