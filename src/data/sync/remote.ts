/**
 * What sync needs from the cloud. The real one talks to Supabase; tests use an in-memory cloud.
 * Every method throws on failure (offline, server error); `DuplicateWordError` is special.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeckId } from '../../domain/leitner/config';
import type { Database } from '../database.types';
import type {
  CardUpload,
  EntryUpload,
  LogUpload,
  RemoteCard,
  RemoteEntry,
  RemoteLog,
  RemoteStreakDay,
  StreakDayUpload,
} from './mapping';

export type PullTable = 'cards' | 'card_entries' | 'review_logs' | 'streak_days';

export interface RemoteRows {
  cards: RemoteCard;
  card_entries: RemoteEntry;
  review_logs: RemoteLog;
  streak_days: RemoteStreakDay;
}

/**
 * Where a pull stopped: the last row's server time (kept exactly as the server wrote it) and id.
 * `id: null` means "everything at or after `at`" (used to start each pull with a safety overlap).
 */
export interface Cursor {
  at: string;
  id: string | null;
}

export interface SyncRemote {
  upsertCards(rows: CardUpload[]): Promise<void>;
  upsertEntries(rows: EntryUpload[]): Promise<void>;
  /** Logs are append-only: one that is already there is left alone. */
  insertLogs(rows: LogUpload[]): Promise<void>;
  /** Append-only too, and one per day: a day the cloud already has (from any device) is left alone. */
  insertStreakDays(rows: StreakDayUpload[]): Promise<void>;
  /** Rows changed after `after` (server time, then id), oldest first. */
  pull<T extends PullTable>(
    table: T,
    after: Cursor | null,
    limit: number,
  ): Promise<RemoteRows[T][]>;
  /** The cloud's live card with this word, ignoring capitals. */
  findCardByWord(word: string, deck: DeckId): Promise<RemoteCard | null>;
  entriesOfCard(cardId: string): Promise<RemoteEntry[]>;
}

/** The cloud already has a live card with this word (unique index cards_user_deck_word_unique). */
export class DuplicateWordError extends Error {
  constructor() {
    super('A card with this word already exists in the cloud.');
    this.name = 'DuplicateWordError';
  }
}

const UNIQUE_VIOLATION = '23505';

function check(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === UNIQUE_VIOLATION) throw new DuplicateWordError();
  throw new Error(`Sync failed: ${error.message}`);
}

/** For `ilike`: match the word exactly, treating % _ \ as plain characters. */
export function exactPattern(word: string): string {
  return word.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function createSupabaseRemote(client: SupabaseClient<Database>): SyncRemote {
  return {
    async upsertCards(rows) {
      check((await client.from('cards').upsert(rows)).error);
    },
    async upsertEntries(rows) {
      check((await client.from('card_entries').upsert(rows)).error);
    },
    async insertLogs(rows) {
      check((await client.from('review_logs').upsert(rows, { ignoreDuplicates: true })).error);
    },
    async insertStreakDays(rows) {
      check(
        (
          await client
            .from('streak_days')
            .upsert(rows, { onConflict: 'user_id,day', ignoreDuplicates: true })
        ).error,
      );
    },
    async pull(table, after, limit) {
      let query = client.from(table).select('*');
      if (after?.id === null) {
        query = query.gte('server_updated_at', after.at);
      } else if (after) {
        query = query.or(
          `server_updated_at.gt."${after.at}",and(server_updated_at.eq."${after.at}",id.gt.${after.id})`,
        );
      }
      const { data, error } = await query.order('server_updated_at').order('id').limit(limit);
      check(error);
      return (data ?? []) as unknown as RemoteRows[typeof table][];
    },
    async findCardByWord(word, deck) {
      const { data, error } = await client
        .from('cards')
        .select('*')
        .eq('deck', deck)
        .ilike('word', exactPattern(word))
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      check(error);
      return data;
    },
    async entriesOfCard(cardId) {
      const { data, error } = await client.from('card_entries').select('*').eq('card_id', cardId);
      check(error);
      return data ?? [];
    },
  };
}
