/**
 * An in-memory Supabase for sync tests. It copies the real database's rules:
 * - server_updated_at is the server's own clock (6 decimals, like Postgres);
 * - an older update never replaces a newer one (trigger a_reject_older_write);
 * - one live card per word, ignoring capitals (cards_user_word_unique) → DuplicateWordError;
 * - entries and logs need their card first (RLS);
 * - review logs are append-only.
 */

import { timeMs } from '../data/sync/merge';
import type {
  CardUpload,
  EntryUpload,
  RemoteCard,
  RemoteEntry,
  RemoteLog,
} from '../data/sync/mapping';
import {
  DuplicateWordError,
  type Cursor,
  type PullTable,
  type RemoteRows,
  type SyncRemote,
} from '../data/sync/remote';

export interface FakeCloud extends SyncRemote {
  offline: boolean;
  tables: {
    cards: Map<string, RemoteCard>;
    card_entries: Map<string, RemoteEntry>;
    review_logs: Map<string, RemoteLog>;
  };
  calls: string[];
  /** Runs inside the next upload, e.g. to edit a row "while it is being sent". */
  duringNextUpload?: () => Promise<void>;
}

export function createFakeCloud(): FakeCloud {
  let tick = 0;
  const serverTime = () =>
    new Date(Date.UTC(2030, 0, 1) + ++tick * 1000)
      .toISOString()
      .replace(/\.(\d{3})Z$/, '.$1000+00:00');

  const cloud: FakeCloud = {
    offline: false,
    tables: { cards: new Map(), card_entries: new Map(), review_logs: new Map() },
    calls: [],

    async upsertCards(rows) {
      await enter('upsertCards');
      const live = [...cloud.tables.cards.values()].filter((c) => c.deleted_at === null);
      for (const row of rows) {
        const clash = live.find(
          (c) =>
            c.id !== row.id &&
            c.word.toLowerCase() === row.word.toLowerCase() &&
            row.deleted_at === null,
        );
        if (clash) throw new DuplicateWordError(); // whole batch fails, like Postgres
      }
      for (const row of rows) write(cloud.tables.cards, row);
    },

    async upsertEntries(rows) {
      await enter('upsertEntries');
      for (const row of rows) needCard(row.card_id);
      for (const row of rows) write(cloud.tables.card_entries, row);
    },

    async insertLogs(rows) {
      await enter('insertLogs');
      for (const row of rows) needCard(row.card_id);
      for (const row of rows) {
        if (!cloud.tables.review_logs.has(row.id)) {
          cloud.tables.review_logs.set(row.id, stamp(row));
        }
      }
    },

    async pull<T extends PullTable>(table: T, after: Cursor | null, limit: number) {
      await enter(`pull:${table}`);
      const rows = [...(cloud.tables[table] as Map<string, RemoteRows[T]>).values()]
        .filter((row) => isAfter(row, after))
        .sort(
          (a, b) =>
            timeMs(a.server_updated_at) - timeMs(b.server_updated_at) || a.id.localeCompare(b.id),
        );
      return structuredClone(rows.slice(0, limit));
    },

    async findCardByWord(word) {
      await enter('findCardByWord');
      const card = [...cloud.tables.cards.values()].find(
        (c) => c.deleted_at === null && c.word.toLowerCase() === word.toLowerCase(),
      );
      return card ? structuredClone(card) : null;
    },

    async entriesOfCard(cardId) {
      await enter('entriesOfCard');
      return structuredClone(
        [...cloud.tables.card_entries.values()].filter((e) => e.card_id === cardId),
      );
    },
  };

  async function enter(call: string) {
    if (cloud.offline) throw new TypeError('Failed to fetch');
    cloud.calls.push(call);
    if (call.startsWith('upsert') || call === 'insertLogs') {
      const hook = cloud.duringNextUpload;
      cloud.duringNextUpload = undefined;
      await hook?.();
    }
  }

  function stamp<T extends object>(row: T) {
    return { ...structuredClone(row), user_id: 'user-1', server_updated_at: serverTime() };
  }

  function write<T extends CardUpload | EntryUpload>(
    table: Map<string, T & { user_id: string; server_updated_at: string }>,
    row: T,
  ) {
    const existing = table.get(row.id);
    if (existing && timeMs(row.updated_at) < timeMs(existing.updated_at)) return; // older: skipped
    table.set(row.id, stamp(row));
  }

  function needCard(cardId: string) {
    if (!cloud.tables.cards.has(cardId))
      throw new Error('new row violates row-level security policy');
  }

  function isAfter(row: { server_updated_at: string; id: string }, after: Cursor | null) {
    if (!after) return true;
    const t = timeMs(row.server_updated_at);
    const a = timeMs(after.at);
    if (after.id === null) return t >= a;
    return t > a || (t === a && row.id > after.id);
  }

  return cloud;
}
