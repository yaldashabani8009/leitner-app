/**
 * Which screen to open at launch. Pure, so every case is tested.
 * PRD: sign in once per device; an expired session never blocks local cards.
 */

export type StartScreen =
  { kind: 'app'; userId: string } | { kind: 'signIn' } | { kind: 'setNewPassword' };

export interface StartFacts {
  /** The user of the session Supabase loaded, if any. */
  sessionUserId: string | null;
  /** Supabase could not refresh the session because there is no connection. */
  offline: boolean;
  /** The account last signed in on this device (kept by us, see lastUser.ts). */
  lastUserId: string | null;
  /** The page was opened from a "reset your password" email. */
  fromRecoveryLink: boolean;
}

export function decideStart(facts: StartFacts): StartScreen {
  if (facts.fromRecoveryLink) return { kind: 'setNewPassword' };
  if (facts.sessionUserId) return { kind: 'app', userId: facts.sessionUserId };
  // Offline with an expired access token: Supabase keeps the session but can't refresh it yet.
  // Open the local cards anyway; sync catches up once back online.
  if (facts.offline && facts.lastUserId) return { kind: 'app', userId: facts.lastUserId };
  return { kind: 'signIn' };
}

/**
 * How long launch waits for the saved session. Offline with an expired token, Supabase keeps
 * retrying for up to 30s; after this we open the local cards and let it finish in the background.
 */
export const START_TIMEOUT_MS = 1500;

/** The promise's value, or `fallback` if it hasn't settled within `ms`. */
export function settleWithin<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
