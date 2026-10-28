import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './storage';

describe('requestPersistentStorage', () => {
  it('returns false when the browser has no storage manager', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false);
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    expect(await requestPersistentStorage({ persisted: async () => true, persist })).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it.each([true, false])('asks and reports the answer (%s)', async (granted) => {
    const storage = { persisted: async () => false, persist: async () => granted };
    expect(await requestPersistentStorage(storage)).toBe(granted);
  });
});
