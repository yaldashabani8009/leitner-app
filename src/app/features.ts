/**
 * Switches that change what the app offers. Each one names what must change with it.
 */

/**
 * Sign-ups are off in Supabase (ADR-010), so "Create an account" is hidden: it could only
 * end in "Sign-ups are closed for now" (audit 2026-10-29). When opening the app to others,
 * turn on "Allow new users to sign up" in Supabase and set this to true, together.
 */
export const SIGNUPS_OPEN = false;
