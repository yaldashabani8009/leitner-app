/**
 * The on-device database (ADR-002). The UI reads from here; Supabase is the cloud copy.
 * One database per signed-in account (Yali's decision, 2026-10-28), so accounts never mix.
 * Field names are camelCase here; sync (roadmap 7.6) maps them to the snake_case columns.
 */

import { Dexie, type EntityTable } from 'dexie';
import type { Box } from '../domain/leitner/config';

export type EntryKind = 'synonym' | 'meaning' | 'sentence';

export interface CardRow {
  id: string;
  word: string;
  /** Lower-case word for the duplicate check (see domain/card wordKey). Local only. */
  wordKey: string;
  box: Box;
  /** Calendar date in the profile time zone, YYYY-MM-DD. */
  dueDate: string;
  masteredAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EntryRow {
  id: string;
  cardId: string;
  kind: EntryKind;
  text: string;
  position: number;
  updatedAt: string;
  deletedAt: string | null;
}

/** Append-only: never updated or deleted. */
export interface ReviewLogRow {
  id: string;
  cardId: string;
  reviewedAt: string;
  correct: boolean;
  boxBefore: Box;
  /** null = mastered by this answer. */
  boxAfter: Box | null;
  isPractice: boolean;
  createdAt: string;
}

/**
 * A day that earned the streak (roadmap 7.11, ADR-015). Saved the moment the day counts,
 * because the PRD rule depends on how many cards were due that day. Append-only.
 * Keyed by day: if another device earned the same day, the first row we see is kept.
 */
export interface StreakDayRow {
  /** Calendar date in the profile time zone, YYYY-MM-DD. */
  day: string;
  id: string;
  createdAt: string;
}

export type SyncedTable = 'cards' | 'entries' | 'reviewLogs' | 'streakDays';

/** "This row changed; send it to the cloud." One row per changed row, however often it changed. */
export interface OutboxRow {
  /** `${table}:${rowId}`, so repeated edits replace the same outbox row. */
  key: string;
  table: SyncedTable;
  rowId: string;
  queuedAt: string;
}

/** Device-only facts in the `meta` table besides the pull positions (roadmap 7.12). */
export const META = {
  /** When a sync with the cloud last finished. */
  lastSyncedAt: 'sync:lastSyncedAt',
  /** When the latest sync attempt failed; removed by the next one that works. */
  lastSyncFailedAt: 'sync:lastSyncFailedAt',
  /** Don't show "Save a copy?" before this moment. */
  saveReminderSnoozedUntil: 'backup:saveSnoozedUntil',
  /** Don't show "Restore your words?" before this moment. */
  restoreOfferSnoozedUntil: 'backup:restoreSnoozedUntil',
  /** The daily-reminder offer: "done" once answered yes, or the moment "Not now" ends (ADR-018). */
  reminderOffer: 'reminder:offer',
} as const;

/** Small device-only facts, e.g. where each table's last pull stopped (sync, ADR-013). */
export interface MetaRow {
  key: string;
  value: unknown;
}

/** Saved on the device at sign-in so "today" works offline. */
export interface ProfileRow {
  userId: string;
  displayName: string | null;
  timeZone: string;
  updatedAt: string;
}

export class LeitnerDb extends Dexie {
  cards!: EntityTable<CardRow, 'id'>;
  entries!: EntityTable<EntryRow, 'id'>;
  reviewLogs!: EntityTable<ReviewLogRow, 'id'>;
  outbox!: EntityTable<OutboxRow, 'key'>;
  profile!: EntityTable<ProfileRow, 'userId'>;
  meta!: EntityTable<MetaRow, 'key'>;
  streakDays!: EntityTable<StreakDayRow, 'day'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      cards: 'id, wordKey, dueDate, updatedAt',
      entries: 'id, cardId, updatedAt',
      reviewLogs: 'id, cardId, reviewedAt',
      outbox: 'key, queuedAt',
      profile: 'userId',
    });
    // v2 (roadmap 7.6): sync cursors.
    this.version(2).stores({ meta: 'key' });
    // v3 (roadmap 7.11): earned streak days, and boxBefore so "words learned" reads only box-1 logs.
    this.version(3).stores({
      reviewLogs: 'id, cardId, reviewedAt, boxBefore',
      streakDays: 'day',
    });
  }
}

export function databaseNameFor(userId: string): string {
  return `leitner-${userId}`;
}

export function openDatabase(userId: string): LeitnerDb {
  return new LeitnerDb(databaseNameFor(userId));
}
