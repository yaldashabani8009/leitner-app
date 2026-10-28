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

export type SyncedTable = 'cards' | 'entries' | 'reviewLogs';

/** "This row changed; send it to the cloud." One row per changed row, however often it changed. */
export interface OutboxRow {
  /** `${table}:${rowId}`, so repeated edits replace the same outbox row. */
  key: string;
  table: SyncedTable;
  rowId: string;
  queuedAt: string;
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

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      cards: 'id, wordKey, dueDate, updatedAt',
      entries: 'id, cardId, updatedAt',
      reviewLogs: 'id, cardId, reviewedAt',
      outbox: 'key, queuedAt',
      profile: 'userId',
    });
  }
}

export function databaseNameFor(userId: string): string {
  return `leitner-${userId}`;
}

export function openDatabase(userId: string): LeitnerDb {
  return new LeitnerDb(databaseNameFor(userId));
}
