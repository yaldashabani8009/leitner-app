/**
 * End-to-end test build only (`vite build --mode e2e`, roadmap 7.14, ADR-017): the real app
 * with an in-memory stand-in for the cloud, so Playwright never signs in to the real Supabase
 * and CI needs no secrets. main.tsx loads this file only in that mode; the published site
 * never contains it.
 * Like the real cloud, it fails while the browser is offline.
 */

import type { AppServices } from '../app/App';
import type { AuthResult, AuthService, SessionClient } from '../data/auth';
import type { ProfileSource } from '../data/profileSync';
import { createFakeCloud } from '../test/fakeCloud';

/** The one account that can sign in. */
export const E2E_ACCOUNT = {
  email: 'yali@example.com',
  password: 'leitner-e2e',
  userId: '0e2e0000-0000-4000-8000-000000000001',
} as const;

const SESSION_KEY = 'leitner-e2e:session';
const offline = () => !navigator.onLine;

export function createE2EServices(): AppServices {
  const listeners = new Set<(userId: string | null) => void>();

  const session: SessionClient = {
    async load() {
      // Like Supabase with an expired token: offline, the saved session can't be refreshed.
      if (offline()) return { userId: null, offline: true };
      return { userId: localStorage.getItem(SESSION_KEY), offline: false };
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  const auth: AuthService = {
    async signIn(email, password): Promise<AuthResult> {
      if (offline()) return { ok: false, problem: 'offline' };
      if (email !== E2E_ACCOUNT.email || password !== E2E_ACCOUNT.password) {
        return { ok: false, problem: 'wrongCredentials' };
      }
      localStorage.setItem(SESSION_KEY, E2E_ACCOUNT.userId);
      for (const listener of listeners) listener(E2E_ACCOUNT.userId);
      return { ok: true };
    },
    signUp: async () => ({ ok: false, problem: 'signupsClosed' }),
    sendPasswordReset: async () => ({ ok: true }),
    setNewPassword: async () => ({ ok: true }),
  };

  const profiles: ProfileSource = {
    async fetchProfile() {
      if (offline()) throw new TypeError('Failed to fetch');
      return {
        display_name: 'Yali',
        time_zone: 'Asia/Tehran',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
    },
  };

  const remote = createFakeCloud();
  Object.defineProperty(remote, 'offline', { get: offline });

  return { session, auth, profiles, remote, fromRecoveryLink: false };
}
