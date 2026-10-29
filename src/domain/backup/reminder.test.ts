import { describe, expect, it } from 'vitest';
import {
  shouldOfferRestore,
  shouldRemindToSave,
  snoozeUntil,
  type RestoreOfferState,
  type SaveReminderState,
} from './reminder';

const day = (n: number) => new Date(Date.UTC(2026, 2, n, 8)).toISOString();

describe('shouldRemindToSave (14 days without the cloud, with unsent changes)', () => {
  const base: SaveReminderState = {
    now: day(20),
    lastSyncedAt: day(6),
    oldestUnsentAt: day(10),
    snoozedUntil: null,
  };

  it('asks once the last sync is 14 days old and changes are waiting', () => {
    expect(shouldRemindToSave(base)).toBe(true);
  });

  it('does not ask before 14 days', () => {
    expect(shouldRemindToSave({ ...base, lastSyncedAt: day(7) })).toBe(false);
  });

  it('never asks when nothing is waiting for the cloud', () => {
    expect(shouldRemindToSave({ ...base, oldestUnsentAt: null })).toBe(false);
  });

  it('without any sync yet, counts from the oldest waiting change', () => {
    expect(shouldRemindToSave({ ...base, lastSyncedAt: null, oldestUnsentAt: day(6) })).toBe(true);
    expect(shouldRemindToSave({ ...base, lastSyncedAt: null, oldestUnsentAt: day(7) })).toBe(false);
  });

  it('waits after "Not now" or a saved copy, then asks again', () => {
    expect(shouldRemindToSave({ ...base, snoozedUntil: day(21) })).toBe(false);
    expect(shouldRemindToSave({ ...base, snoozedUntil: day(20) })).toBe(true);
  });
});

describe('shouldOfferRestore (empty box and the cloud unreachable)', () => {
  const base: RestoreOfferState = {
    now: day(20),
    cardCount: 0,
    lastSyncedAt: null,
    lastSyncFailed: true,
    snoozedUntil: null,
  };

  it('offers a restore when the box is empty and the cloud cannot be reached', () => {
    expect(shouldOfferRestore(base)).toBe(true);
  });

  it.each<[string, Partial<RestoreOfferState>]>([
    ['the box has cards', { cardCount: 3 }],
    ['this device synced before (its words came from the cloud)', { lastSyncedAt: day(1) }],
    ['the cloud has not failed (a new box, still syncing)', { lastSyncFailed: false }],
    ['"Not now" was tapped this week', { snoozedUntil: day(25) }],
  ])('does not offer it when %s', (_label, change) => {
    expect(shouldOfferRestore({ ...base, ...change })).toBe(false);
  });
});

describe('snoozeUntil', () => {
  it('is 7 days later', () => {
    expect(snoozeUntil(day(10))).toBe(day(17));
  });
});
