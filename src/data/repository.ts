/**
 * The repository: the only way the app writes to the on-device database (CLAUDE.md, ADR-003).
 * Each write runs in one transaction: save the change, apply the domain rules, and queue it
 * in the outbox for sync. If any part fails, nothing is saved.
 */

import {
  LIST_FIELDS,
  validateCard,
  wordKey,
  type CardDraft,
  type EntryInput,
  type FieldErrors,
  type ListField,
} from '../domain/card/validate';
import { answer, newCard, resetToBox1 } from '../domain/leitner/engine';
import { pickSessionCards, reviewsDoneToday } from '../domain/session/pick';
import { isOnOrBefore } from '../domain/time/calendarDate';
import { dateInZone, resolveTimeZone } from '../domain/time/zonedDate';
import type {
  CardRow,
  EntryKind,
  EntryRow,
  LeitnerDb,
  ProfileRow,
  ReviewLogRow,
  SyncedTable,
} from './db';

/** Where the repository gets the time and new ids. Tests pass fixed ones. */
export interface RepositoryDeps {
  /** Current moment as a UTC ISO string. */
  now(): string;
  newId(): string;
}

export const browserDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

const KIND_OF: Record<ListField, EntryKind> = {
  synonyms: 'synonym',
  meanings: 'meaning',
  sentences: 'sentence',
};

/** Longest possible distance between UTC and a local midnight (+14h) plus a day, with margin. */
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

/** UTC+14 (Kiribati): the first place where a new day starts. */
const LATEST_TIME_ZONE = 'Etc/GMT-14';

export type AddCardResult =
  | { status: 'created'; cardId: string }
  /** The word already existed: that card was sent back to box 1, due tomorrow; open it instead. */
  | { status: 'duplicate'; cardId: string }
  | { status: 'invalid'; errors: FieldErrors };

export type EditCardResult = { status: 'saved' } | { status: 'invalid'; errors: FieldErrors };

export interface CardWithEntries {
  card: CardRow;
  synonyms: EntryRow[];
  meanings: EntryRow[];
  sentences: EntryRow[];
}

export function createRepository(db: LeitnerDb, deps: RepositoryDeps = browserDeps) {
  const queue = (table: SyncedTable, rowId: string, now: string) =>
    db.outbox.put({ key: `${table}:${rowId}`, table, rowId, queuedAt: now });

  async function timeZone(): Promise<string> {
    const profile = await db.profile.toCollection().first();
    return resolveTimeZone(profile?.timeZone);
  }

  async function today(now: string): Promise<string> {
    return dateInZone(now, await timeZone());
  }

  /** The live (not deleted) card with this word, if any. */
  async function findByWord(word: string): Promise<CardRow | undefined> {
    return db.cards
      .where('wordKey')
      .equals(wordKey(word))
      .filter((card) => card.deletedAt === null)
      .first();
  }

  async function liveEntries(cardId: string): Promise<EntryRow[]> {
    const rows = await db.entries.where('cardId').equals(cardId).toArray();
    return rows.filter((e) => e.deletedAt === null).sort((a, b) => a.position - b.position);
  }

  const ALL_TABLES = [db.cards, db.entries, db.reviewLogs, db.outbox, db.profile];

  return {
    /**
     * The id of the live card with this word (ignoring capitals and extra spaces), if any.
     * The add sheet asks this first, so the duplicate dialog can offer "Open my card" or "Cancel".
     */
    async findCardIdByWord(word: string): Promise<string | undefined> {
      return (await findByWord(word))?.id;
    },

    /**
     * Duplicate rule (PRD "Card structure"): send an existing card back to box 1, due tomorrow,
     * mastered or not. Called when you choose "Open my card".
     */
    sendCardBackToStart(cardId: string): Promise<void> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        const card = await db.cards.get(cardId);
        if (!card || card.deletedAt !== null) throw new Error(`No card with id ${cardId}`);
        await db.cards.put({ ...card, ...resetToBox1(await today(now)), updatedAt: now });
        await queue('cards', cardId, now);
      });
    },

    /**
     * Add a word. If it already exists (ignoring capitals and spaces), no copy is made:
     * the existing card goes back to box 1, due tomorrow (mastered or not), and its id is returned.
     */
    addCard(draft: CardDraft): Promise<AddCardResult> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        const existing = await findByWord(draft.word);
        if (existing) {
          await db.cards.put({ ...existing, ...resetToBox1(await today(now)), updatedAt: now });
          await queue('cards', existing.id, now);
          return { status: 'duplicate', cardId: existing.id };
        }

        const result = validateCard(draft);
        if (!result.ok) return { status: 'invalid', errors: result.errors };

        const { card: valid } = result;
        const cardId = deps.newId();
        await db.cards.add({
          id: cardId,
          word: valid.word,
          wordKey: wordKey(valid.word),
          ...newCard(await today(now)),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        await queue('cards', cardId, now);

        for (const field of LIST_FIELDS) {
          for (const [position, entry] of valid[field].entries()) {
            await addEntry(cardId, KIND_OF[field], entry, position, now);
          }
        }
        return { status: 'created', cardId };
      });
    },

    /**
     * Edit a card's word and lists. Never changes its box or due date.
     * Renaming to a word that another card already has is refused (Yali's decision, 2026-10-28).
     * List items keep their id when edited; items left out are soft-deleted so the deletion syncs.
     */
    editCard(cardId: string, draft: CardDraft): Promise<EditCardResult> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        const card = await db.cards.get(cardId);
        if (!card || card.deletedAt !== null) throw new Error(`No card with id ${cardId}`);

        const result = validateCard(draft);
        if (!result.ok) return { status: 'invalid', errors: result.errors };
        const { card: valid } = result;

        const other = await findByWord(valid.word);
        if (other && other.id !== cardId)
          return { status: 'invalid', errors: { word: 'duplicate' } };

        if (valid.word !== card.word) {
          await db.cards.put({
            ...card,
            word: valid.word,
            wordKey: wordKey(valid.word),
            updatedAt: now,
          });
          await queue('cards', cardId, now);
        }

        const current = await liveEntries(cardId);
        for (const field of LIST_FIELDS) {
          const kind = KIND_OF[field];
          const before = new Map(current.filter((e) => e.kind === kind).map((e) => [e.id, e]));
          const kept = new Set<string>();

          for (const [position, input] of valid[field].entries()) {
            const old = input.id === undefined ? undefined : before.get(input.id);
            if (old) {
              kept.add(old.id);
              if (old.text !== input.text || old.position !== position) {
                await db.entries.put({ ...old, text: input.text, position, updatedAt: now });
                await queue('entries', old.id, now);
              }
            } else {
              await addEntry(cardId, kind, input, position, now);
            }
          }

          for (const old of before.values()) {
            if (!kept.has(old.id)) {
              await db.entries.put({ ...old, deletedAt: now, updatedAt: now });
              await queue('entries', old.id, now);
            }
          }
        }
        return { status: 'saved' };
      });
    },

    /**
     * Save one answer from a session.
     * "scheduled": move the card with the Leitner engine and log it.
     * "practice": log it only; the card does not change (sessions rule 6).
     */
    recordAnswer(
      cardId: string,
      correct: boolean,
      kind: 'scheduled' | 'practice',
    ): Promise<ReviewLogRow> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        const card = await db.cards.get(cardId);
        if (!card || card.deletedAt !== null) throw new Error(`No card with id ${cardId}`);

        let boxAfter: ReviewLogRow['boxAfter'] = card.box;
        if (kind === 'scheduled') {
          const result = answer(card, correct, await today(now), now);
          await db.cards.put({ ...card, ...result.schedule, updatedAt: now });
          await queue('cards', cardId, now);
          boxAfter = result.log.boxAfter;
        }

        const log: ReviewLogRow = {
          id: deps.newId(),
          cardId,
          reviewedAt: now,
          correct,
          boxBefore: card.box,
          boxAfter,
          isPractice: kind === 'practice',
          createdAt: now,
        };
        await db.reviewLogs.add(log);
        await queue('reviewLogs', log.id, now);
        return log;
      });
    },

    /** Store the signed-in profile on the device (it comes from Supabase at sign-in). */
    async saveProfile(profile: ProfileRow): Promise<void> {
      await db.transaction('rw', db.profile, async () => {
        await db.profile.clear();
        await db.profile.put(profile);
      });
    },

    // ---------- Reads (wrap these in useLiveQuery in the UI) ----------

    getProfile(): Promise<ProfileRow | undefined> {
      return db.profile.toCollection().first();
    },

    /** How many live cards are in the box. */
    countCards(): Promise<number> {
      return db.cards.filter((card) => card.deletedAt === null).count();
    },

    async getCard(cardId: string): Promise<CardWithEntries | undefined> {
      const card = await db.cards.get(cardId);
      if (!card || card.deletedAt !== null) return undefined;
      const entries = await liveEntries(cardId);
      const of = (kind: EntryKind) => entries.filter((e) => e.kind === kind);
      return { card, synonyms: of('synonym'), meanings: of('meaning'), sentences: of('sentence') };
    },

    reviewsDoneToday: countReviewsToday,

    /** The card ids for the next session; empty means "All done for today". */
    async nextSessionCardIds(): Promise<string[]> {
      const now = deps.now();
      // Every read starts before the first await, so useLiveQuery sees all of them and
      // refreshes after each answer. (Dexie only tracks reads that start inside its live
      // query; awaiting a plain async helper first would hide the later ones.)
      const [profile, maybeDue, recent] = await Promise.all([
        db.profile.toCollection().first(),
        // The latest "today" anywhere on Earth; narrowed to the profile's day below.
        db.cards
          .where('dueDate')
          .belowOrEqual(dateInZone(now, LATEST_TIME_ZONE))
          .filter((card) => card.deletedAt === null)
          .toArray(),
        recentLogs(now),
      ]);
      const zone = resolveTimeZone(profile?.timeZone);
      const date = dateInZone(now, zone);
      const due = maybeDue.filter((card) => isOnOrBefore(card.dueDate, date));
      return pickSessionCards(due, reviewsDoneToday(recent, now, zone), date);
    },
  };

  /** Review logs recent enough to include the whole of "today" in any time zone. */
  function recentLogs(now: string) {
    const since = new Date(Date.parse(now) - LOOKBACK_MS).toISOString();
    return db.reviewLogs.where('reviewedAt').aboveOrEqual(since).toArray();
  }

  /** Scheduled reviews done on the profile's "today". */
  async function countReviewsToday(): Promise<number> {
    const now = deps.now();
    const [profile, recent] = await Promise.all([
      db.profile.toCollection().first(),
      recentLogs(now),
    ]);
    return reviewsDoneToday(recent, now, resolveTimeZone(profile?.timeZone));
  }

  async function addEntry(
    cardId: string,
    kind: EntryKind,
    input: EntryInput,
    position: number,
    now: string,
  ): Promise<void> {
    const id = deps.newId();
    await db.entries.add({
      id,
      cardId,
      kind,
      text: input.text,
      position,
      updatedAt: now,
      deletedAt: null,
    });
    await queue('entries', id, now);
  }
}

export type Repository = ReturnType<typeof createRepository>;
