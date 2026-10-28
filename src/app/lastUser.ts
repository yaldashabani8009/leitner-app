/**
 * Remembers which account last signed in on this device, so the app can open its local
 * cards offline even when Supabase can't refresh the session yet (see startup.ts).
 */

const KEY = 'leitner:lastUserId';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readLastUser(store: KeyValueStore = localStorage): string | null {
  try {
    return store.getItem(KEY);
  } catch {
    return null; // Private browsing or blocked storage: behave as a fresh device.
  }
}

export function writeLastUser(userId: string | null, store: KeyValueStore = localStorage): void {
  try {
    if (userId) store.setItem(KEY, userId);
    else store.removeItem(KEY);
  } catch {
    // Nothing to do: the app still works online.
  }
}
