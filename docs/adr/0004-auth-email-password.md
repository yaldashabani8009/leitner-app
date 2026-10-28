# ADR-004: Supabase Auth with email + password

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

Sign in once per device and stay signed in. It must work inside an installed PWA on both iPhone and Android, and be free.

## Options considered

1. **Email + password**: works identically on both phones inside the installed app, with no email round-trip. Cons: a password to remember.
2. **6-digit email code (OTP)**: no password. Cons: inbox trip for each new device; Supabase's free built-in email is rate-limited.
3. **Google OAuth**: one tap on Android. Cons: on iPhone the flow can escape to Safari, which doesn't share storage with the installed PWA; extra Google Cloud setup; may be unreliable from Iran.
4. **Magic link**: rejected for the same iPhone/Safari reason.

## Decision

**Supabase Auth, email + password**, with persistent sessions and silent token refresh.

## Consequences

- Screens needed: Sign in, Sign up (email, password, display name), Forgot password.
- `display_name` and `time_zone` are sent as sign-up metadata; a database trigger creates the profile row.
- Public sign-ups stay **off** until launch (ADR-010).
- Before opening to the public, plug in free custom SMTP (e.g. Resend's free tier) for confirmation/reset emails.
