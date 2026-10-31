// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthService, SessionClient } from '../data/auth';
import { createFakeCloud } from '../test/fakeCloud';
import { App, type AppServices } from './App';
import { readLastUser } from './lastUser';

const auth: AuthService = {
  signIn: async () => ({ ok: true }),
  signUp: async () => ({ ok: true }),
  sendPasswordReset: async () => ({ ok: true }),
  setNewPassword: async () => ({ ok: true }),
};

function services(
  loaded: { userId: string | null; offline: boolean },
  extra: Partial<AppServices> = {},
) {
  let listener: (userId: string | null) => void = () => {};
  const session: SessionClient = {
    load: vi.fn(async () => loaded),
    onChange: (l) => {
      listener = l;
      return () => {};
    },
  };
  const value: AppServices = {
    session,
    auth,
    profiles: {
      fetchProfile: async () => ({
        display_name: 'Yali',
        time_zone: 'Asia/Tehran',
        updated_at: '2026-10-28T10:00:00Z',
      }),
    },
    remote: createFakeCloud(),
    fromRecoveryLink: false,
    minLoadingMs: 0,
    ...extra,
  };
  return { value, emit: (userId: string | null) => act(() => listener(userId)) };
}

beforeEach(() => {
  localStorage.clear();
});

describe('App start-up', () => {
  it('first launch → Sign in', async () => {
    render(<App services={services({ userId: null, offline: false }).value} />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('cold start: only the cream page while the session loads, never a nameless "Leitner"', async () => {
    const { value } = services({ userId: null, offline: false });
    value.session.load = () => new Promise(() => {}); // still loading
    render(<App services={value} />);
    expect(screen.getByLabelText('Opening your box')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('signed in → loading with the profile name copied onto the device, then the box', async () => {
    const userId = `u-${crypto.randomUUID()}`;
    render(<App services={services({ userId, offline: false }, { minLoadingMs: 300 }).value} />);
    expect(await screen.findByRole('heading', { name: "Yali's Leitner." })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Your box is empty' })).toBeInTheDocument();
    expect(readLastUser()).toBe(userId);
  });

  it('syncs on open: a card added on another device shows up', async () => {
    const cloud = createFakeCloud();
    await cloud.upsertCards([
      {
        id: crypto.randomUUID(),
        word: 'brave',
        deck: 'vocab',
        added_on: '2026-03-10',
        box: 1,
        due_date: '2026-03-11',
        mastered_at: null,
        created_at: '2026-03-10T08:00:00.000Z',
        updated_at: '2026-03-10T08:00:00.000Z',
        deleted_at: null,
      },
    ]);
    const { value } = services(
      { userId: `u-${crypto.randomUUID()}`, offline: false },
      { remote: cloud },
    );
    render(<App services={value} />);
    // Due in the past → its review card shows.
    expect(await screen.findByText('brave')).toBeInTheDocument();
  });

  it('offline with an expired session → still opens the box of the last account', async () => {
    localStorage.setItem('leitner:lastUserId', 'u-offline');
    render(<App services={services({ userId: null, offline: true }).value} />);
    expect(await screen.findByRole('heading', { name: 'Your box is empty' })).toBeInTheDocument();
  });

  it('offline and Supabase never answers → opens the last account’s box after the wait', async () => {
    localStorage.setItem('leitner:lastUserId', 'u-hanging');
    const { value } = services({ userId: null, offline: false }, { startTimeoutMs: 50 });
    value.session.load = () => new Promise(() => {});
    render(<App services={value} />);
    expect(await screen.findByRole('heading', { name: 'Your box is empty' })).toBeInTheDocument();
  });

  it('from a reset email → choose a new password, even once the link signs in', async () => {
    const { value, emit } = services({ userId: 'u1', offline: false }, { fromRecoveryLink: true });
    render(<App services={value} />);
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
    await emit('u1');
    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
  });
});

describe('App sign-in changes', () => {
  it('signing in moves from Sign in to the box', async () => {
    const { value, emit } = services({ userId: null, offline: false });
    render(<App services={value} />);
    await screen.findByRole('heading', { name: 'Welcome back' });
    await emit(`u-${crypto.randomUUID()}`);
    expect(await screen.findByRole('heading', { name: 'Your box is empty' })).toBeInTheDocument();
  });

  it('a session that ends goes back to Sign in and forgets the account', async () => {
    const { value, emit } = services({ userId: `u-${crypto.randomUUID()}`, offline: false });
    render(<App services={value} />);
    await screen.findByRole('heading', { name: 'Your box is empty' });
    await emit(null);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(readLastUser()).toBeNull();
  });

  it('moves between Sign in and Forgot password (no sign-up while sign-ups are closed)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<App services={services({ userId: null, offline: false }).value} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('heading', { name: 'Forgot password?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create an account' })).not.toBeInTheDocument();
  });
});
