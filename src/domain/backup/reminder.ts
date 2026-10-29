/**
 * When the backup modals appear (Yali's decisions, 2026-10-29). Normally never: sync keeps the
 * cloud copy. Pure: the caller passes "now" and what the device knows about sync.
 * Timestamps are the device's own UTC ISO strings.
 */

import { BACKUP_REMINDER_AFTER_DAYS, BACKUP_REMINDER_SNOOZE_DAYS } from '../leitner/config';

const DAY_MS = 24 * 60 * 60 * 1000;

const ms = (timestamp: string) => Date.parse(timestamp);
const snoozed = (now: string, until: string | null) => until !== null && ms(now) < ms(until);

export interface SaveReminderState {
  now: string;
  /** Last time a sync with the cloud finished; null if this device never managed one. */
  lastSyncedAt: string | null;
  /** When the oldest change still waiting for the cloud was made; null if none is waiting. */
  oldestUnsentAt: string | null;
  /** "Not now" or a saved copy: don't ask before this moment. */
  snoozedUntil: string | null;
}

/**
 * "Save a copy?" shows when the cloud hasn't been reached for 14 days and there are changes
 * the cloud doesn't have yet. Without any sync yet, the 14 days count from the oldest change.
 */
export function shouldRemindToSave(state: SaveReminderState): boolean {
  if (state.oldestUnsentAt === null || snoozed(state.now, state.snoozedUntil)) return false;
  const since = state.lastSyncedAt ?? state.oldestUnsentAt;
  return ms(state.now) - ms(since) >= BACKUP_REMINDER_AFTER_DAYS * DAY_MS;
}

export interface RestoreOfferState {
  now: string;
  /** All cards on the device, deleted ones too. */
  cardCount: number;
  lastSyncedAt: string | null;
  /** The latest sync attempt failed (offline, or the cloud is blocked). */
  lastSyncFailed: boolean;
  snoozedUntil: string | null;
}

/**
 * "Restore your words?" shows only when the box on this device is empty and the cloud can't
 * be reached: the moment the app's data was lost while offline. A device that synced once
 * already got its words from the cloud, so it never asks.
 */
export function shouldOfferRestore(state: RestoreOfferState): boolean {
  return (
    state.cardCount === 0 &&
    state.lastSyncedAt === null &&
    state.lastSyncFailed &&
    !snoozed(state.now, state.snoozedUntil)
  );
}

/** "Not now" (or a saved copy): ask again in 7 days. */
export function snoozeUntil(now: string): string {
  return new Date(ms(now) + BACKUP_REMINDER_SNOOZE_DAYS * DAY_MS).toISOString();
}
