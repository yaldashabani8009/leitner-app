import { describe, expect, it } from 'vitest';
import { readLastUser, writeLastUser } from './lastUser';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const broken = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('last signed-in account', () => {
  it('remembers and forgets the account', () => {
    const store = memoryStore();
    expect(readLastUser(store)).toBeNull();
    writeLastUser('u1', store);
    expect(readLastUser(store)).toBe('u1');
    writeLastUser(null, store);
    expect(readLastUser(store)).toBeNull();
  });

  it('behaves like a fresh device when storage is blocked', () => {
    expect(readLastUser(broken)).toBeNull();
    expect(() => writeLastUser('u1', broken)).not.toThrow();
  });
});
