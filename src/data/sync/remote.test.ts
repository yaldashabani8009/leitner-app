import { describe, expect, it, vi } from 'vitest';
import { createSupabaseRemote, DuplicateWordError, exactPattern } from './remote';

describe('exactPattern', () => {
  it('treats % _ and \\ as plain characters', () => {
    expect(exactPattern('brave')).toBe('brave');
    expect(exactPattern('100%_sure\\')).toBe('100\\%\\_sure\\\\');
  });
});

/** Just enough of the Supabase client to see what the remote does with errors. */
function clientReturning(error: { code?: string; message: string } | null) {
  const upsert = vi.fn(async () => ({ error }));
  const client = { from: vi.fn(() => ({ upsert })) };
  return { client: client as unknown as Parameters<typeof createSupabaseRemote>[0], upsert };
}

describe('createSupabaseRemote errors', () => {
  it('a duplicate word (Postgres 23505) becomes DuplicateWordError', async () => {
    const { client } = clientReturning({ code: '23505', message: 'duplicate key value' });
    await expect(createSupabaseRemote(client).upsertCards([])).rejects.toBeInstanceOf(
      DuplicateWordError,
    );
  });

  it('any other failure is a plain error, so sync retries later', async () => {
    const { client } = clientReturning({ message: 'TypeError: Failed to fetch' });
    await expect(createSupabaseRemote(client).upsertEntries([])).rejects.toThrow(
      'Sync failed: TypeError: Failed to fetch',
    );
  });

  it('logs are uploaded append-only (existing ones ignored)', async () => {
    const { client, upsert } = clientReturning(null);
    await createSupabaseRemote(client).insertLogs([]);
    expect(upsert).toHaveBeenCalledWith([], { ignoreDuplicates: true });
  });
});
