# ADR-010: Multi-user ready from day one, sign-ups closed until launch

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

Today the app has one user (the owner). It may open to other users later. Adding security afterwards is how data leaks happen.

## Options considered

1. **Single-user shortcuts now, retrofit later**: less work today. Cons: risky rewrite later.
2. **Multi-user ready now, sign-ups closed**: a bit more work now; opening up later is a dashboard toggle.

## Decision

- Every table carries `user_id`, and **Row Level Security** restricts every row to its owner (`supabase/migrations/`).
- `review_logs` has no update/delete policy (append-only).
- Real Sign up / Forgot password screens are built.
- **Public sign-ups are disabled** in Supabase until launch.

## Consequences

- The browser's publishable key is safe to ship because RLS is on.
- Launch checklist: enable sign-ups, add free custom SMTP, review the free-tier limits (500 MB database, ~50k monthly active users).
- Note: Supabase pauses free projects after ~1 week without activity; restore from the dashboard. Local-first means the app keeps working meanwhile.
