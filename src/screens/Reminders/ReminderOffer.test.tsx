// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb } from '../../data/db';
import type { ReminderService } from '../../data/reminders';
import { createRepository, type Repository } from '../../data/repository';
import { keyBytes } from './push';
import { ReminderOffer } from './ReminderOffer';

const NOW = '2026-03-10T16:00:00.000Z';
let db: LeitnerDb;
let repo: Repository;
let now: string;

/** A phone that can do push: permission not asked yet, subscribe() shows the prompt. */
function phone({ allow = true } = {}) {
  const subscription = {
    endpoint: 'https://push.example/device-1',
    toJSON: () => ({ keys: { p256dh: 'device-key', auth: 'device-auth' } }),
  };
  const permission = { value: 'default' as NotificationPermission };
  const subscribe = vi.fn(async () => {
    permission.value = allow ? 'granted' : 'denied';
    if (!allow) throw new DOMException('denied', 'NotAllowedError');
    return subscription;
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', {
    get permission() {
      return permission.value;
    },
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { subscribe } }) },
  });
  return { subscribe };
}

function cloud(publicKey: string | null = 'BAQIDBA'): ReminderService & {
  saved: unknown[];
  tests: number;
} {
  const service = {
    saved: [] as unknown[],
    tests: 0,
    publicKey: async () => publicKey,
    save: async (sub: unknown) => {
      service.saved.push(sub);
    },
    sendTest: async () => {
      service.tests += 1;
    },
  };
  return service;
}

beforeEach(() => {
  db = new LeitnerDb(`reminder-${crypto.randomUUID()}`);
  now = NOW;
  repo = createRepository(db, { now: () => now, newId: () => crypto.randomUUID() });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  // @ts-expect-error test cleanup of the stubbed property
  delete navigator.serviceWorker;
  await db.delete();
});

describe('ReminderOffer', () => {
  it('yes: the phone asks, the device is saved, a test notification is sent', async () => {
    const { subscribe } = phone();
    const service = cloud();
    render(<ReminderOffer repo={repo} reminders={service} active />);

    await userEvent.click(await screen.findByRole('button', { name: 'Yes, remind me' }));
    expect(await screen.findByRole('dialog', { name: 'Reminders are on!' })).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: keyBytes('BAQIDBA'),
    });
    expect(service.saved).toEqual([
      { endpoint: 'https://push.example/device-1', p256dh: 'device-key', auth: 'device-auth' },
    ]);
    await waitFor(() => expect(service.tests).toBe(1));
    expect(await repo.reminderOfferOpen()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('the phone says no: explains where to allow it later, and waits a week', async () => {
    phone({ allow: false });
    const service = cloud();
    render(<ReminderOffer repo={repo} reminders={service} active />);
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, remind me' }));
    expect(
      await screen.findByRole('dialog', { name: 'Notifications are off' }),
    ).toBeInTheDocument();
    expect(service.saved).toEqual([]);
    expect(await repo.reminderOfferOpen()).toBe(false);
    now = '2026-03-17T16:00:00.000Z';
    expect(await repo.reminderOfferOpen()).toBe(true);
  });

  it('"Not now" closes it and asks again in 7 days', async () => {
    phone();
    render(<ReminderOffer repo={repo} reminders={cloud()} active />);
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    now = '2026-03-17T15:59:00.000Z';
    expect(await repo.reminderOfferOpen()).toBe(false);
    now = '2026-03-17T16:00:00.000Z';
    expect(await repo.reminderOfferOpen()).toBe(true);
  });

  it.each([
    ['before "I\'m done for now"', { active: false }],
    ['without the push key (offline, or the end-to-end build)', { key: null }],
    ['where the phone has no push (Safari outside the installed app)', { noPush: true }],
  ])(
    'stays hidden %s',
    async (_label, options: { active?: boolean; key?: null; noPush?: boolean }) => {
      phone();
      if (options.noPush) vi.stubGlobal('PushManager', undefined);
      if (options.noPush) delete (window as unknown as Record<string, unknown>).PushManager;
      render(
        <ReminderOffer
          repo={repo}
          reminders={cloud(options.key === null ? null : 'BAQIDBA')}
          active={options.active ?? true}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );
});

describe('keyBytes', () => {
  it('turns the base64url key into bytes', () => {
    expect([...keyBytes('BAQIDBA')]).toEqual([4, 4, 8, 12, 16]);
    expect([...keyBytes('-_8')]).toEqual([251, 255]);
  });
});
