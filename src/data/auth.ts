/**
 * Sign in, sign up and password reset with Supabase Auth (ADR-004).
 * Screens talk to the `AuthService` interface, so tests can pass a fake one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthProblem =
  | 'wrongCredentials'
  | 'signupsClosed'
  | 'emailTaken'
  | 'weakPassword'
  | 'samePassword'
  | 'emailNotConfirmed'
  | 'tooManyTries'
  | 'offline'
  | 'unknown';

export type AuthResult = { ok: true } | { ok: false; problem: AuthProblem };

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthService {
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  sendPasswordReset(email: string): Promise<AuthResult>;
  setNewPassword(password: string): Promise<AuthResult>;
  /** Signs out on this device (Settings, canvas N13). The session listener then shows Sign in. */
  signOut(): Promise<void>;
}

/** The saved sign-in on this device. */
export interface SessionClient {
  /** The saved session's user, and whether loading it failed for lack of a connection. */
  load(): Promise<{ userId: string | null; offline: boolean }>;
  /** Called when someone signs in or the session ends; returns an unsubscribe function. */
  onChange(listener: (userId: string | null) => void): () => void;
}

export const AUTH_MESSAGES: Record<AuthProblem, string> = {
  wrongCredentials: "That email and password don't match. Try again?",
  signupsClosed: 'Sign-ups are closed for now.',
  emailTaken: "There's already an account with this email. Sign in instead?",
  weakPassword: 'Pick a longer password: at least 6 characters.',
  samePassword: "That's your current password. Pick a new one.",
  emailNotConfirmed: 'Confirm your email first. Check your inbox.',
  tooManyTries: 'Too many tries. Wait a few minutes, then try again.',
  offline: "You're offline. Try again when you're connected.",
  unknown: 'Something went wrong. Please try again.',
};

const PROBLEM_BY_CODE: Record<string, AuthProblem> = {
  invalid_credentials: 'wrongCredentials',
  signup_disabled: 'signupsClosed',
  user_already_exists: 'emailTaken',
  email_exists: 'emailTaken',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  email_not_confirmed: 'emailNotConfirmed',
  over_email_send_rate_limit: 'tooManyTries',
  over_request_rate_limit: 'tooManyTries',
};

/** Turns a Supabase auth error into a problem the screens know how to explain. */
export function problemFromError(error: { name?: string; code?: string }): AuthProblem {
  // No connection (or Supabase unreachable, e.g. from Iran): a retryable fetch error.
  if (error.name === 'AuthRetryableFetchError') return 'offline';
  return PROBLEM_BY_CODE[error.code ?? ''] ?? 'unknown';
}

/** The phone's time zone, used only to pre-fill a new profile (Yali's decision, 2026-10-28). */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type AuthClient = Pick<
  SupabaseClient['auth'],
  'signInWithPassword' | 'signUp' | 'resetPasswordForEmail' | 'updateUser' | 'signOut'
>;

/**
 * The real service. `siteUrl` is where emails link back to, e.g.
 * https://yaldashabani8009.github.io/leitner-app/ (must be allowed in Supabase → URL Configuration).
 */
export function createSupabaseAuth(
  auth: AuthClient,
  siteUrl: string,
  timeZone = deviceTimeZone,
): AuthService {
  const result = async (
    call: Promise<{ error: { name?: string; code?: string } | null }>,
  ): Promise<AuthResult> => {
    try {
      const { error } = await call;
      return error ? { ok: false, problem: problemFromError(error) } : { ok: true };
    } catch {
      return { ok: false, problem: 'offline' };
    }
  };

  return {
    signIn: (email, password) => result(auth.signInWithPassword({ email, password })),
    signUp: ({ email, password, displayName }) =>
      result(
        auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: siteUrl,
            // A database trigger turns these into the profile row (see supabase/migrations).
            data: { display_name: displayName, time_zone: timeZone() },
          },
        }),
      ),
    sendPasswordReset: (email) =>
      result(auth.resetPasswordForEmail(email, { redirectTo: siteUrl })),
    setNewPassword: (password) => result(auth.updateUser({ password })),
    async signOut() {
      // Local scope: works offline too; the device forgets the session at once.
      await auth.signOut({ scope: 'local' });
    },
  };
}
