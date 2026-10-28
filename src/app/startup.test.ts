import { describe, expect, it, vi } from 'vitest';
import { decideStart, settleWithin, START_TIMEOUT_MS, type StartFacts } from './startup';

const none: StartFacts = {
  sessionUserId: null,
  offline: false,
  lastUserId: null,
  fromRecoveryLink: false,
};

describe('decideStart', () => {
  it('signed in → straight to the cards', () => {
    expect(decideStart({ ...none, sessionUserId: 'u1', lastUserId: 'u1' })).toEqual({
      kind: 'app',
      userId: 'u1',
    });
  });

  it('first launch on a device → sign in', () => {
    expect(decideStart(none)).toEqual({ kind: 'signIn' });
  });

  it('offline with an expired session → the last account’s local cards (never blocked)', () => {
    expect(decideStart({ ...none, offline: true, lastUserId: 'u1' })).toEqual({
      kind: 'app',
      userId: 'u1',
    });
  });

  it('offline on a device nobody signed in on yet → sign in', () => {
    expect(decideStart({ ...none, offline: true })).toEqual({ kind: 'signIn' });
  });

  it('online but the session really ended → sign in (the cards stay saved on the device)', () => {
    expect(decideStart({ ...none, lastUserId: 'u1' })).toEqual({ kind: 'signIn' });
  });

  it('a session always wins over the remembered account', () => {
    expect(decideStart({ ...none, sessionUserId: 'u2', lastUserId: 'u1' })).toEqual({
      kind: 'app',
      userId: 'u2',
    });
  });

  it('opened from a reset-password email → choose a new password', () => {
    expect(decideStart({ ...none, sessionUserId: 'u1', fromRecoveryLink: true })).toEqual({
      kind: 'setNewPassword',
    });
  });
});

describe('settleWithin', () => {
  it('gives the value when it arrives in time', async () => {
    expect(await settleWithin(Promise.resolve('session'), 1000, 'fallback')).toBe('session');
  });

  it('gives the fallback when it takes too long (offline, Supabase still retrying)', async () => {
    vi.useFakeTimers();
    const result = settleWithin(new Promise<string>(() => {}), START_TIMEOUT_MS, 'fallback');
    vi.advanceTimersByTime(START_TIMEOUT_MS);
    expect(await result).toBe('fallback');
    vi.useRealTimers();
  });

  it('gives the fallback when loading fails', async () => {
    expect(await settleWithin(Promise.reject(new Error('x')), 1000, 'fallback')).toBe('fallback');
  });
});
