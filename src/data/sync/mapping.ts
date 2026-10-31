/**
 * Converting rows between the device (camelCase, db.ts) and the cloud (snake_case, migrations).
 * Uploads leave out user_id (the database fills it from the signed-in user) and
 * server_updated_at (always stamped by the server, ADR-013).
 */

import { wordKey } from '../../domain/card/validate';
import type { Box } from '../../domain/leitner/config';
import { deckOrVocab } from '../../domain/decks/decks';
import type { Database } from '../database.types';
import type { CardRow, EntryRow, ReviewLogRow, StreakDayRow } from '../db';

type Tables = Database['public']['Tables'];
export type RemoteCard = Tables['cards']['Row'];
export type RemoteEntry = Tables['card_entries']['Row'];
export type RemoteLog = Tables['review_logs']['Row'];
export type RemoteStreakDay = Tables['streak_days']['Row'];

export type CardUpload = Omit<RemoteCard, 'user_id' | 'server_updated_at'>;
export type EntryUpload = Omit<RemoteEntry, 'user_id' | 'server_updated_at'>;
export type LogUpload = Omit<RemoteLog, 'user_id' | 'server_updated_at'>;
export type StreakDayUpload = Omit<RemoteStreakDay, 'user_id' | 'server_updated_at'>;

export function cardToRemote(card: CardRow): CardUpload {
  return {
    id: card.id,
    word: card.word,
    deck: card.deck,
    added_on: card.addedOn,
    box: card.box,
    due_date: card.dueDate,
    mastered_at: card.masteredAt,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
    deleted_at: card.deletedAt,
  };
}

export function cardFromRemote(row: RemoteCard): CardRow {
  return {
    id: row.id,
    word: row.word,
    deck: deckOrVocab(row.deck),
    wordKey: wordKey(row.word),
    // Rows from before v3 may lack it: fall back to the creation day.
    addedOn: row.added_on ?? row.created_at.slice(0, 10),
    box: row.box as Box,
    dueDate: row.due_date,
    masteredAt: row.mastered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function entryToRemote(entry: EntryRow): EntryUpload {
  return {
    id: entry.id,
    card_id: entry.cardId,
    kind: entry.kind,
    text: entry.text,
    translation: entry.translation ?? null,
    position: entry.position,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt,
  };
}

export function entryFromRemote(row: RemoteEntry): EntryRow {
  return {
    id: row.id,
    cardId: row.card_id,
    kind: row.kind,
    text: row.text,
    translation: row.translation ?? null,
    position: row.position,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function logToRemote(log: ReviewLogRow): LogUpload {
  return {
    id: log.id,
    card_id: log.cardId,
    reviewed_at: log.reviewedAt,
    correct: log.correct,
    box_before: log.boxBefore,
    box_after: log.boxAfter,
    is_practice: log.isPractice,
    typed_answer: log.typedAnswer ?? null,
    created_at: log.createdAt,
  };
}

export function logFromRemote(row: RemoteLog): ReviewLogRow {
  return {
    id: row.id,
    cardId: row.card_id,
    reviewedAt: row.reviewed_at,
    correct: row.correct,
    boxBefore: row.box_before as Box,
    boxAfter: row.box_after as Box | null,
    isPractice: row.is_practice,
    typedAnswer: row.typed_answer ?? null,
    createdAt: row.created_at,
  };
}

export function streakDayToRemote(row: StreakDayRow): StreakDayUpload {
  return { id: row.id, day: row.day, created_at: row.createdAt };
}

export function streakDayFromRemote(row: RemoteStreakDay): StreakDayRow {
  return { day: row.day, id: row.id, createdAt: row.created_at };
}
