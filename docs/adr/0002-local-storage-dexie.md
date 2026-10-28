# ADR-002: Dexie (IndexedDB) for on-device storage

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The app is local-first: the phone's database is what the UI reads and writes; Supabase is the cloud copy. Browsers offer IndexedDB (supported on iPhone Safari and Android Chrome), but its raw API is awkward. Must be free.

## Options considered

1. **Dexie**: readable queries, `useLiveQuery` re-renders React when data changes (including changes from background sync), built-in schema versioning. Free and open source (only the optional Dexie Cloud service is paid, and we don't use it). Cons: sync must be written by us.
2. **idb**: tiny thin wrapper. Cons: we'd hand-write queries, live updates and migrations.
3. **RxDB**: built-in Supabase replication. Cons: heavy, many concepts, some features paid, hard to debug.

## Decision

**Dexie 4 + dexie-react-hooks.** No Dexie Cloud.

## Consequences

- UI components read data with `useLiveQuery`; no manual refresh logic.
- Schema changes = bump `db.version(n)` with an upgrade function.
- We own a small sync module (ADR-003).
- Call `navigator.storage.persist()` on first launch to make iOS less likely to evict data.
