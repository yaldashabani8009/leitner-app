import { describe, expect, it } from 'vitest';
import { backupFileName, readBackup, wordCount, type Backup } from './file';

const T = '2026-03-10T08:00:00.000Z';

function sample(): Backup {
  return {
    app: 'leitner-backup',
    version: 1,
    exportedAt: T,
    userId: 'u1',
    profile: { displayName: 'Yali', timeZone: 'Asia/Tehran' },
    cards: [
      {
        id: 'c1',
        word: 'brave',
        box: 2,
        dueDate: '2026-03-12',
        masteredAt: null,
        createdAt: T,
        // A row pulled from the cloud keeps Postgres' own format.
        updatedAt: '2026-03-10 08:00:00.123456+00:00',
        deletedAt: null,
      },
      {
        id: 'c2',
        word: 'calm',
        box: 1,
        dueDate: '2026-03-11',
        masteredAt: null,
        createdAt: T,
        updatedAt: T,
        deletedAt: T,
      },
    ],
    entries: [
      {
        id: 'e1',
        cardId: 'c1',
        kind: 'synonym',
        text: 'bold',
        position: 0,
        updatedAt: T,
        deletedAt: null,
      },
    ],
    reviewLogs: [
      {
        id: 'l1',
        cardId: 'c1',
        reviewedAt: T,
        correct: true,
        boxBefore: 1,
        boxAfter: 2,
        isPractice: false,
        createdAt: T,
      },
      {
        id: 'l2',
        cardId: 'c1',
        reviewedAt: T,
        correct: true,
        boxBefore: 5,
        boxAfter: null,
        isPractice: false,
        createdAt: T,
      },
    ],
    streakDays: [{ day: '2026-03-10', id: 's1', createdAt: T }],
  };
}

const read = (value: unknown) => readBackup(JSON.stringify(value));

describe('readBackup', () => {
  it('reads back exactly what was written', () => {
    expect(read(sample())).toEqual({ ok: true, backup: sample() });
  });

  it('accepts a backup without a profile', () => {
    const backup = { ...sample(), profile: null };
    expect(read(backup)).toEqual({ ok: true, backup });
  });

  it('drops fields it does not know', () => {
    const raw = { ...sample(), extra: 1, cards: [{ ...sample().cards[0], wordKey: 'brave' }] };
    const result = readBackup(JSON.stringify(raw));
    expect(result.ok && result.backup.cards[0]).toEqual(sample().cards[0]);
    expect(result.ok && 'extra' in result.backup).toBe(false);
  });

  it.each([
    ['not JSON', 'hello'],
    ['JSON but not an object', '[1, 2]'],
    ['null', 'null'],
    ['another app', JSON.stringify({ ...sample(), app: 'notes' })],
  ])('refuses %s as not a backup', (_label, fileText) => {
    expect(readBackup(fileText)).toEqual({ ok: false, problem: 'notABackup' });
  });

  it('refuses a backup from a newer version of the app', () => {
    expect(read({ ...sample(), version: 2 })).toEqual({ ok: false, problem: 'newerVersion' });
  });

  const card = sample().cards[0];
  const entry = sample().entries[0];
  const log = sample().reviewLogs[0];
  it.each<[string, Record<string, unknown>]>([
    ['version 0', { version: 0 }],
    ['version as text', { version: '1' }],
    ['no export time', { exportedAt: undefined }],
    ['an export time that is not a time', { exportedAt: 'yesterday' }],
    ['no account', { userId: '' }],
    ['a broken profile', { profile: { displayName: 'Yali' } }],
    ['no profile field', { profile: undefined }],
    ['cards not a list', { cards: {} }],
    ['a card that is not an object', { cards: ['brave'] }],
    ['a card in box 6', { cards: [{ ...card, box: 6 }] }],
    ['a card in box 0', { cards: [{ ...card, box: 0 }] }],
    ['a card with an empty word', { cards: [{ ...card, word: '' }] }],
    ['an impossible due date', { cards: [{ ...card, dueDate: '2026-02-30' }] }],
    ['a due date that is a number', { cards: [{ ...card, dueDate: 20260312 }] }],
    ['a missing deletedAt', { cards: [{ ...card, deletedAt: undefined }] }],
    ['an unknown list kind', { entries: [{ ...entry, kind: 'note' }] }],
    ['a negative position', { entries: [{ ...entry, position: -1 }] }],
    ['a review that is not true/false', { reviewLogs: [{ ...log, correct: 'yes' }] }],
    ['a streak day that is not a date', { streakDays: [{ day: 'today', id: 's', createdAt: T }] }],
    ['a list item without its card', { entries: [{ ...entry, cardId: 'gone' }] }],
    ['a review without its card', { reviewLogs: [{ ...log, cardId: 'gone' }] }],
  ])('refuses %s as damaged', (_label, change) => {
    expect(read({ ...sample(), ...change })).toEqual({ ok: false, problem: 'damaged' });
  });
});

describe('wordCount', () => {
  it('counts the words that are not deleted', () => {
    expect(wordCount(sample())).toBe(1);
  });
});

describe('backupFileName', () => {
  it('is dated in the profile time zone', () => {
    // 21:00 UTC on the 10th is already the 11th in Tehran.
    expect(backupFileName('2026-03-10T21:00:00.000Z', 'Asia/Tehran')).toBe(
      'leitner-backup-2026-03-11.json',
    );
    expect(backupFileName('2026-03-10T21:00:00.000Z', 'America/New_York')).toBe(
      'leitner-backup-2026-03-10.json',
    );
  });
});
