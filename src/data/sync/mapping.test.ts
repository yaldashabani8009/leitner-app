import { describe, expect, it } from 'vitest';
import type { CardRow, EntryRow, ReviewLogRow } from '../db';
import {
  cardFromRemote,
  cardToRemote,
  entryFromRemote,
  entryToRemote,
  logFromRemote,
  logToRemote,
} from './mapping';

const cloudFields = { user_id: 'user-1', server_updated_at: '2030-01-01T00:00:01.000000+00:00' };

describe('device ↔ cloud rows', () => {
  it('a card survives the round trip; the duplicate key is rebuilt from the word', () => {
    const card: CardRow = {
      id: 'c1',
      word: 'Ice Cream',
      wordKey: 'ice cream',
      box: 3,
      dueDate: '2026-03-14',
      masteredAt: null,
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-03-10T08:00:00.000Z',
      deletedAt: null,
    };
    const upload = cardToRemote(card);
    expect(upload).not.toHaveProperty('user_id');
    expect(upload).not.toHaveProperty('server_updated_at');
    expect(cardFromRemote({ ...upload, ...cloudFields })).toEqual(card);
  });

  it('an entry survives the round trip', () => {
    const entry: EntryRow = {
      id: 'e1',
      cardId: 'c1',
      kind: 'meaning',
      text: 'بستنی',
      position: 2,
      updatedAt: '2026-03-10T08:00:00.000Z',
      deletedAt: '2026-03-11T08:00:00.000Z',
    };
    expect(entryFromRemote({ ...entryToRemote(entry), ...cloudFields })).toEqual(entry);
  });

  it('a review log survives the round trip, including "mastered" (box after = null)', () => {
    const log: ReviewLogRow = {
      id: 'l1',
      cardId: 'c1',
      reviewedAt: '2026-03-10T08:00:00.000Z',
      correct: true,
      boxBefore: 5,
      boxAfter: null,
      isPractice: false,
      createdAt: '2026-03-10T08:00:00.000Z',
    };
    expect(logFromRemote({ ...logToRemote(log), ...cloudFields })).toEqual(log);
  });
});
