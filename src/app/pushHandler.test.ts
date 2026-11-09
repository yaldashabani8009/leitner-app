import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/** Runs public/push-handler.js against a fake service worker and returns its push listener. */
function loadHandler(earlier: { close: () => void }[]) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const shown: { title: string; options: unknown }[] = [];
  const fakeSelf = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
    registration: {
      getNotifications: vi.fn(async () => earlier),
      showNotification: vi.fn(async (title: string, options: unknown) => {
        shown.push({ title, options });
      }),
    },
  };
  const source = readFileSync(new URL('../../public/push-handler.js', import.meta.url), 'utf8');
  new Function('self', 'navigator', source)(fakeSelf, {});
  return { push: listeners.push, shown };
}

describe('push handler (bug 1, 2026-11-09)', () => {
  it("closes the earlier reminders before showing today's, so they don't pile up", async () => {
    const yesterday = { close: vi.fn() };
    const dayBefore = { close: vi.fn() };
    const { push, shown } = loadHandler([yesterday, dayBefore]);
    let done: Promise<unknown> = Promise.resolve();
    push({
      data: { json: () => ({ title: 'Time for your words', body: '52 cards waiting', badge: 52 }) },
      waitUntil: (promise: Promise<unknown>) => {
        done = promise;
      },
    });
    await done;
    expect(yesterday.close).toHaveBeenCalled();
    expect(dayBefore.close).toHaveBeenCalled();
    expect(shown).toEqual([
      {
        title: 'Time for your words',
        options: { body: '52 cards waiting', icon: 'icons/icon-192.png', tag: 'daily-reminder' },
      },
    ]);
  });
});
