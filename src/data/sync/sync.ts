/**
 * Sync (ADR-003, ADR-013): push the outbox, then pull what changed in the cloud.
 * Safe to run any time: offline it fails and the outbox simply waits for the next run.
 */

import {
  META,
  type CardRow,
  type EntryRow,
  type LeitnerDb,
  type OutboxRow,
  type StreakDayRow,
  type SyncedTable,
} from '../db';
import {
  cardFromRemote,
  cardToRemote,
  entryFromRemote,
  entryToRemote,
  logFromRemote,
  logToRemote,
  streakDayFromRemote,
  streakDayToRemote,
} from './mapping';
import { planEntryMerge, remoteWins, shouldAddLog, timeMs } from './merge';
import { DuplicateWordError, type Cursor, type PullTable, type SyncRemote } from './remote';

export const PUSH_BATCH = 200;
export const PULL_PAGE = 1000;
/** Each pull re-reads the last minute, in case a slow cloud write landed with an earlier time. */
export const PULL_OVERLAP_MS = 60_000;

/** The database needs a card before its entries and logs (RLS), so push in this order. */
const PUSH_ORDER: SyncedTable[] = ['cards', 'entries', 'reviewLogs', 'streakDays'];
const PULL_ORDER: PullTable[] = ['cards', 'card_entries', 'review_logs', 'streak_days'];
const LOCAL_TABLE: Record<PullTable, SyncedTable> = {
  cards: 'cards',
  card_entries: 'entries',
  review_logs: 'reviewLogs',
  streak_days: 'streakDays',
};

export interface SyncDeps {
  now(): string;
}

export interface SyncSummary {
  pushed: number;
  pulled: number;
  /** Words that had been added on two devices and were merged into one card. */
  merged: number;
}

export function createSync(db: LeitnerDb, remote: SyncRemote, deps: SyncDeps) {
  const outboxKey = (table: SyncedTable, id: string) => `${table}:${id}`;

  /** Remove sent rows from the outbox, unless they were edited again while sending. */
  async function markSent(items: OutboxRow[]) {
    await db.transaction('rw', db.outbox, async () => {
      for (const item of items) {
        const current = await db.outbox.get(item.key);
        if (current?.queuedAt === item.queuedAt) await db.outbox.delete(item.key);
      }
    });
  }

  async function upload(table: SyncedTable, ids: string[]): Promise<string[]> {
    if (table === 'cards') {
      const rows = (await db.cards.bulkGet(ids)).filter((r): r is CardRow => r !== undefined);
      await remote.upsertCards(rows.map(cardToRemote));
      return rows.map((r) => r.id);
    }
    if (table === 'entries') {
      const rows = (await db.entries.bulkGet(ids)).filter((r): r is EntryRow => r !== undefined);
      await remote.upsertEntries(rows.map(entryToRemote));
      return rows.map((r) => r.id);
    }
    if (table === 'streakDays') {
      const rows = (await db.streakDays.bulkGet(ids)).filter(
        (r): r is StreakDayRow => r !== undefined,
      );
      await remote.insertStreakDays(rows.map(streakDayToRemote));
      return rows.map((r) => r.day);
    }
    const rows = (await db.reviewLogs.bulkGet(ids)).filter((r) => r !== undefined);
    await remote.insertLogs(rows.map(logToRemote));
    return rows.map((r) => r.id);
  }

  /**
   * The cloud already has this word (added on another device while both were offline).
   * Merge into the cloud card (Yali's decision, 2026-10-28): its box and due date stay,
   * the lists are combined without repeats, and the review history moves over.
   */
  async function mergeIntoCloudCard(local: CardRow): Promise<void> {
    const cloud = await remote.findCardByWord(local.word, local.deck);
    if (!cloud) throw new Error(`Duplicate word "${local.word}" but no cloud card found.`);
    const cloudEntries = (await remote.entriesOfCard(cloud.id)).map(entryFromRemote);
    const now = deps.now();

    await db.transaction('rw', [db.cards, db.entries, db.reviewLogs, db.outbox], async () => {
      await db.cards.put(cardFromRemote(cloud));
      for (const entry of cloudEntries) {
        if (remoteWins(await db.entries.get(entry.id), entry)) await db.entries.put(entry);
      }

      const deviceEntries = await db.entries.where('cardId').equals(local.id).toArray();
      const plan = planEntryMerge(cloudEntries, deviceEntries);
      for (const { entry, position } of plan.move) {
        await db.entries.put({ ...entry, cardId: cloud.id, position, updatedAt: now });
        await db.outbox.put({
          key: outboxKey('entries', entry.id),
          table: 'entries',
          rowId: entry.id,
          queuedAt: now,
        });
      }
      // Dropped repeats and deleted items of the local card never reached the cloud: just remove them.
      const moved = new Set(plan.move.map((m) => m.entry.id));
      for (const entry of deviceEntries.filter((e) => !moved.has(e.id))) {
        await db.entries.delete(entry.id);
        await db.outbox.delete(outboxKey('entries', entry.id));
      }

      const logs = await db.reviewLogs.where('cardId').equals(local.id).toArray();
      for (const log of logs) await db.reviewLogs.put({ ...log, cardId: cloud.id });

      await db.cards.delete(local.id);
      await db.outbox.delete(outboxKey('cards', local.id));
    });
  }

  async function pushCardsOneByOne(
    items: OutboxRow[],
  ): Promise<{ sent: OutboxRow[]; merged: number }> {
    const sent: OutboxRow[] = [];
    let merged = 0;
    for (const item of items) {
      try {
        await upload('cards', [item.rowId]);
        sent.push(item);
      } catch (error) {
        if (!(error instanceof DuplicateWordError)) throw error;
        const local = await db.cards.get(item.rowId);
        if (local) await mergeIntoCloudCard(local);
        merged += 1;
      }
    }
    return { sent, merged };
  }

  async function push(): Promise<{ pushed: number; merged: number }> {
    let pushed = 0;
    let merged = 0;
    for (const table of PUSH_ORDER) {
      // Read the outbox per table: merging a duplicate word re-queues entries and logs.
      const items = await db.outbox.where('key').startsWith(`${table}:`).toArray();
      for (let i = 0; i < items.length; i += PUSH_BATCH) {
        const batch = items.slice(i, i + PUSH_BATCH);
        try {
          await upload(
            table,
            batch.map((item) => item.rowId),
          );
          await markSent(batch);
          pushed += batch.length;
        } catch (error) {
          // One duplicate word fails the whole batch: retry it card by card to find and merge it.
          if (!(error instanceof DuplicateWordError) || table !== 'cards') throw error;
          const result = await pushCardsOneByOne(batch);
          await markSent(result.sent);
          pushed += result.sent.length;
          merged += result.merged;
        }
      }
    }
    return { pushed, merged };
  }

  async function applyRemote(table: PullTable, rows: unknown[]): Promise<void> {
    const local = LOCAL_TABLE[table];
    const tables = [db.cards, db.entries, db.reviewLogs, db.streakDays, db.outbox];
    await db.transaction('rw', tables, async () => {
      for (const raw of rows) {
        if (table === 'streak_days') {
          // One row per day: a day this device already earned keeps its own row.
          const day = streakDayFromRemote(raw as Parameters<typeof streakDayFromRemote>[0]);
          if (!(await db.streakDays.get(day.day))) await db.streakDays.add(day);
          continue;
        }
        if (table === 'review_logs') {
          const log = logFromRemote(raw as Parameters<typeof logFromRemote>[0]);
          if (shouldAddLog(await db.reviewLogs.get(log.id))) await db.reviewLogs.add(log);
          continue;
        }
        const row =
          table === 'cards'
            ? cardFromRemote(raw as Parameters<typeof cardFromRemote>[0])
            : entryFromRemote(raw as Parameters<typeof entryFromRemote>[0]);
        const current =
          table === 'cards' ? await db.cards.get(row.id) : await db.entries.get(row.id);
        if (!remoteWins(current, row)) continue;
        if (table === 'cards') await db.cards.put(row as CardRow);
        else await db.entries.put(row as EntryRow);
        // The cloud copy is newer: a pending older edit of this row must not be sent any more.
        await db.outbox.delete(outboxKey(local, row.id));
      }
    });
  }

  async function pull(): Promise<number> {
    let pulled = 0;
    for (const table of PULL_ORDER) {
      const metaKey = `pull:${table}`;
      const saved = (await db.meta.get(metaKey))?.value as Cursor | undefined;
      let after: Cursor | null = saved
        ? { at: new Date(timeMs(saved.at) - PULL_OVERLAP_MS).toISOString(), id: null }
        : null;
      for (;;) {
        const rows = await remote.pull(table, after, PULL_PAGE);
        if (rows.length === 0) break;
        await applyRemote(table, rows);
        pulled += rows.length;
        const last = rows[rows.length - 1];
        after = { at: last.server_updated_at, id: last.id };
        // Progress is kept page by page; the cursor never moves backwards.
        if (!saved || timeMs(after.at) >= timeMs(saved.at)) {
          await db.meta.put({ key: metaKey, value: after });
        }
        if (rows.length < PULL_PAGE) break;
      }
    }
    return pulled;
  }

  return {
    /** Push, then pull. Throws when offline or the cloud fails; nothing is lost, just retry later. */
    async run(): Promise<SyncSummary> {
      let summary: SyncSummary;
      try {
        const { pushed, merged } = await push();
        const pulled = await pull();
        summary = { pushed, pulled, merged };
      } catch (error) {
        // Remembered for the backup modals (7.12); the error itself still goes to the caller.
        await db.meta.put({ key: META.lastSyncFailedAt, value: deps.now() }).catch(() => {});
        throw error;
      }
      await db.meta.put({ key: META.lastSyncedAt, value: deps.now() });
      await db.meta.delete(META.lastSyncFailedAt);
      return summary;
    },
  };
}

export type Sync = ReturnType<typeof createSync>;
