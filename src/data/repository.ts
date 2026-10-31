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
  normalizeWord,
  MAX_WORD_LENGTH,
} from '../domain/card/validate';
import { BACKUP_APP, BACKUP_VERSION, type Backup, type BackupEntry } from '../domain/backup/file';
import { shouldOfferRestore, shouldRemindToSave, snoozeUntil } from '../domain/backup/reminder';
import { enabledDecks } from '../domain/decks/decks';
import { answer, isDue, newCard, resetToBox1 } from '../domain/leitner/engine';
import { currentStreak, wordsLearned } from '../domain/progress/progress';
import type { DeckId } from '../domain/leitner/config';
import { pickSessionCards, reviewsDoneToday, waitingInDeck } from '../domain/session/pick';
import type { WordRow } from '../domain/allWords/allWords';
import { mixDecks, type Random } from '../domain/session/mix';
import { resumeSession } from '../domain/session/resume';
import type { Session } from '../domain/session/session';
import { dayCountsForStreak } from '../domain/session/streakDay';
import { isOnOrBefore } from '../domain/time/calendarDate';
import { dateInZone, resolveTimeZone } from '../domain/time/zonedDate';
import {
  META,
  type CardRow,
  type SavedSession,
  type EntryKind,
  type EntryRow,
  type LeitnerDb,
  type ProfileRow,
  type ReviewLogRow,
  type SyncedTable,
} from './db';
import { planEntryMerge, remoteWins } from './sync/merge';

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

/** One deck on the Today screen (v3 brief 1.4). */
export interface DeckStatus {
  deck: DeckId;
  /** Live cards in the deck. 0 → "Empty". */
  cardCount: number;
  /** Due and within the deck's daily limit. > 0 → "20 waiting". */
  waiting: number;
  /** Cards left in today's session that was left half way; null when there is none. */
  pausedLeft: number | null;
  /** Live cards added (or re-added) today: extra practice is offered when > 0. */
  addedToday: number;
}

/** A "Mix them all" session, with each card's deck for the chip by the progress bar (N6). */
export interface MixSession {
  session: Session;
  deckOf: Record<string, DeckId>;
}

export type EditCardResult = { status: 'saved' } | { status: 'invalid'; errors: FieldErrors };

/** Which backup modal should show now (roadmap 7.12); normally neither. */
export interface BackupStatus {
  saveReminder: boolean;
  restoreOffer: boolean;
}

export type ImportResult =
  | { status: 'imported'; wordsAdded: number; wordsUpdated: number }
  /** The file came from another account; nothing was saved. */
  | { status: 'otherAccount' };

/** The two top-bar numbers (PRD "Streak and progress"). */
export interface Progress {
  wordsLearned: number;
  /** Days in a row; shows the run up to yesterday until today is earned. */
  streak: number;
}

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
  async function findByWord(word: string, deck: DeckId = 'vocab'): Promise<CardRow | undefined> {
    return db.cards
      .where('[deck+wordKey]')
      .equals([deck, wordKey(word)])
      .filter((card) => card.deletedAt === null)
      .first();
  }

  async function liveEntries(cardId: string): Promise<EntryRow[]> {
    const rows = await db.entries.where('cardId').equals(cardId).toArray();
    return rows.filter((e) => e.deletedAt === null).sort((a, b) => a.position - b.position);
  }

  const ALL_TABLES = [db.cards, db.entries, db.reviewLogs, db.streakDays, db.outbox, db.profile];

  /**
   * Save today as a streak day once it meets the PRD rule (ADR-015). Runs inside the write
   * that may earn it: a scheduled answer or a new word. The rule needs today's due cards,
   * which can't be worked out later, so the day is saved now and never removed.
   */
  async function saveStreakDayIfEarned(now: string, wordsAdded: number): Promise<void> {
    const [zone, maybeDue, recent] = await Promise.all([
      timeZone(),
      maybeDueCards(now),
      recentLogs(now),
    ]);
    const date = dateInZone(now, zone);
    if (await db.streakDays.get(date)) return;
    const earned = dayCountsForStreak({
      scheduledReviews: reviewsDoneToday(recent, now, zone),
      cardsStillDue: maybeDue.filter((card) => isDue(card, date)).length,
      // Only the add path passes 1; an answer earns the day by reviews alone.
      wordsAdded,
    });
    if (!earned) return;
    await db.streakDays.add({ day: date, id: deps.newId(), createdAt: now });
    await queue('streakDays', date, now);
  }

  function editCardTx(cardId: string, draft: CardDraft): Promise<EditCardResult> {
    return db.transaction('rw', ALL_TABLES, async () => {
      const now = deps.now();
      const card = await db.cards.get(cardId);
      if (!card || card.deletedAt !== null) throw new Error(`No card with id ${cardId}`);

      const result = validateCard(draft, card.deck);
      if (!result.ok) return { status: 'invalid', errors: result.errors };
      const { card: valid } = result;

      const other = await findByWord(valid.word, card.deck);
      if (other && other.id !== cardId) return { status: 'invalid', errors: { word: 'duplicate' } };

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
            const translation = input.translation ?? null;
            if (
              old.text !== input.text ||
              old.position !== position ||
              (old.translation ?? null) !== translation
            ) {
              await db.entries.put({
                ...old,
                text: input.text,
                translation,
                position,
                updatedAt: now,
              });
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
  }

  /** Each deck's state for the Today screen. */
  async function deckStatusesOf(decks: readonly DeckId[]): Promise<DeckStatus[]> {
    const now = deps.now();
    // Every read starts before the first await (see nextSessionCardIds).
    const [profile, maybeDue, recent, perDeck] = await Promise.all([
      db.profile.toCollection().first(),
      maybeDueCards(now),
      recentLogs(now),
      Promise.all(
        decks.map((deck) =>
          Promise.all([
            db.cards.where('deck').equals(deck).toArray(),
            db.meta.get(`${META.sessionOf}${deck}`),
          ]),
        ),
      ),
    ]);
    const zone = resolveTimeZone(profile?.timeZone);
    const date = dateInZone(now, zone);
    const deckOf = new Map<string, DeckId>();
    for (const [cards] of perDeck) for (const card of cards) deckOf.set(card.id, card.deck);
    const logs = recent.map((log) => ({ ...log, deck: deckOf.get(log.cardId) }));
    const todayLogs = logs.filter((log) => dateInZone(log.reviewedAt, zone) === date);

    return decks.map((deck, index) => {
      const [cards, meta] = perDeck[index];
      const live = cards.filter((card) => card.deletedAt === null);
      const due = maybeDue.filter((card) => card.deck === deck && isDue(card, date)).length;
      const saved = meta?.value as SavedSession | undefined;
      let pausedLeft: number | null = null;
      if (saved && saved.date === date) {
        const session = resumeSession(saved.scheduled, todayLogs);
        const left = session.scheduled.length + session.practice.length - session.answered;
        if (left > 0 && session.answered > 0) pausedLeft = left;
      }
      return {
        deck,
        cardCount: live.length,
        waiting: waitingInDeck(due, reviewsDoneToday(logs, now, zone, deck), deck),
        pausedLeft,
        addedToday: live.filter((card) => card.addedOn === date).length,
      };
    });
  }

  return {
    /**
     * The id of the live card with this word (ignoring capitals and extra spaces), if any.
     * The add sheet asks this first, so the duplicate dialog can offer "Open my card" or "Cancel".
     */
    async findCardIdByWord(word: string, deck: DeckId = 'vocab'): Promise<string | undefined> {
      return (await findByWord(word, deck))?.id;
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
        const date = await today(now);
        await db.cards.put({ ...card, ...resetToBox1(date), addedOn: date, updatedAt: now });
        await queue('cards', cardId, now);
      });
    },

    /**
     * Add a word. If it already exists (ignoring capitals and spaces), no copy is made:
     * the existing card goes back to box 1, due tomorrow (mastered or not), and its id is returned.
     */
    addCard(draft: CardDraft, deck: DeckId = 'vocab'): Promise<AddCardResult> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        const existing = await findByWord(draft.word, deck);
        const date = await today(now);
        if (existing) {
          await db.cards.put({ ...existing, ...resetToBox1(date), addedOn: date, updatedAt: now });
          await queue('cards', existing.id, now);
          return { status: 'duplicate', cardId: existing.id };
        }

        const result = validateCard(draft, deck);
        if (!result.ok) return { status: 'invalid', errors: result.errors };

        const { card: valid } = result;
        const cardId = deps.newId();
        await db.cards.add({
          id: cardId,
          word: valid.word,
          deck,
          wordKey: wordKey(valid.word),
          addedOn: date,
          ...newCard(date),
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
        await saveStreakDayIfEarned(now, 1);
        return { status: 'created', cardId };
      });
    },

    /**
     * Spelling words from the add sheet's check step (v3 brief 1.2): one card per word, word only,
     * deck "spelling", added today, all in one write through the outbox. Words already in the
     * Spelling deck (ignoring capitals) are skipped; Vocab cards are never touched.
     */
    addSpellingWords(words: readonly string[]): Promise<{ saved: number }> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        const date = await today(now);
        let saved = 0;
        const seen = new Set<string>();
        for (const raw of words) {
          const word = normalizeWord(raw);
          const key = wordKey(word);
          if (word === '' || [...word].length > MAX_WORD_LENGTH || seen.has(key)) continue;
          seen.add(key);
          if (await findByWord(word, 'spelling')) continue;
          const cardId = deps.newId();
          await db.cards.add({
            id: cardId,
            word,
            deck: 'spelling',
            wordKey: key,
            addedOn: date,
            ...newCard(date),
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          await queue('cards', cardId, now);
          saved += 1;
        }
        if (saved > 0) await saveStreakDayIfEarned(now, saved);
        return { saved };
      });
    },

    /** The words already in the Spelling deck, as keys (lower case), for "already there" chips. */
    async spellingKeys(): Promise<Set<string>> {
      const cards = await db.cards.where('deck').equals('spelling').toArray();
      return new Set(cards.filter((card) => card.deletedAt === null).map((card) => card.wordKey));
    },

    /**
     * Edit a card's word and lists. Never changes its box or due date.
     * Renaming to a word that another card already has is refused (Yali's decision, 2026-10-28).
     * List items keep their id when edited; items left out are soft-deleted so the deletion syncs.
     */
    editCard(cardId: string, draft: CardDraft): Promise<EditCardResult> {
      return editCardTx(cardId, draft);
    },

    /**
     * "Save & start over" in the add sheet (v3 brief 1.8, canvas N5): the word was already in this
     * deck, so its card is updated with the form, goes back to box 1 (due tomorrow) and counts as
     * added today. All in one write.
     */
    saveAndStartOver(cardId: string, draft: CardDraft): Promise<EditCardResult> {
      return db.transaction('rw', ALL_TABLES, async () => {
        const result = await editCardTx(cardId, draft);
        if (result.status !== 'saved') return result;
        const now = deps.now();
        const card = (await db.cards.get(cardId))!;
        const date = await today(now);
        await db.cards.put({ ...card, ...resetToBox1(date), addedOn: date, updatedAt: now });
        await queue('cards', cardId, now);
        return result;
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
          typedAnswer: null,
          createdAt: now,
        };
        await db.reviewLogs.add(log);
        await queue('reviewLogs', log.id, now);
        if (kind === 'scheduled') await saveStreakDayIfEarned(now, 0);
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

    /**
     * Every live card for the all-words page (v3 brief 1.9), with its Persian meanings and its
     * "Not yet" count from real reviews. Reads only the device, so it works offline.
     */
    async allWordRows(): Promise<WordRow[]> {
      const [cards, meanings, misses] = await Promise.all([
        db.cards.filter((card) => card.deletedAt === null).toArray(),
        db.entries
          .filter(
            (entry) =>
              entry.deletedAt === null &&
              (entry.kind === 'meaning' || (entry.kind === 'sentence' && !!entry.translation)),
          )
          .toArray(),
        db.reviewLogs.filter((log) => !log.correct && !log.isPractice).toArray(),
      ]);
      const meaningsOf = new Map<string, { text: string; position: number }[]>();
      const translationsOf = new Map<string, string[]>();
      for (const entry of meanings) {
        if (entry.kind === 'sentence') {
          translationsOf.set(entry.cardId, [
            ...(translationsOf.get(entry.cardId) ?? []),
            entry.translation!,
          ]);
          continue;
        }
        meaningsOf.set(entry.cardId, [...(meaningsOf.get(entry.cardId) ?? []), entry]);
      }
      const missesOf = new Map<string, number>();
      for (const log of misses) missesOf.set(log.cardId, (missesOf.get(log.cardId) ?? 0) + 1);
      return cards.map((card) => ({
        id: card.id,
        word: card.word,
        deck: card.deck,
        box: card.box,
        mastered: card.masteredAt !== null,
        addedOn: card.addedOn,
        createdAt: card.createdAt,
        meanings: (meaningsOf.get(card.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((entry) => entry.text),
        misses: missesOf.get(card.id) ?? 0,
        translations: translationsOf.get(card.id) ?? [],
      }));
    },

    /** Soft-delete a card (swipe left → Delete, N9); the deletion syncs. */
    deleteCard(cardId: string): Promise<void> {
      return db.transaction('rw', [db.cards, db.outbox], async () => {
        const now = deps.now();
        const card = await db.cards.get(cardId);
        if (!card || card.deletedAt !== null) return;
        await db.cards.put({ ...card, deletedAt: now, updatedAt: now });
        await queue('cards', cardId, now);
      });
    },

    /** Undo a delete (the toast's Undo, N10): the card comes back exactly as it was. */
    restoreCard(cardId: string): Promise<void> {
      return db.transaction('rw', [db.cards, db.outbox], async () => {
        const now = deps.now();
        const card = await db.cards.get(cardId);
        if (!card || card.deletedAt === null) return;
        await db.cards.put({ ...card, deletedAt: null, updatedAt: now });
        await queue('cards', cardId, now);
      });
    },

    /** How many live cards are in the box, in every deck (the top-bar box badge). */
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

    /** Should a backup modal show? Read with useLiveQuery; normally both are false. */
    async backupStatus(): Promise<BackupStatus> {
      const now = deps.now();
      const metaValue = (key: string) =>
        db.meta.get(key).then((row) => (row?.value as string | undefined) ?? null);
      const [lastSyncedAt, lastSyncFailedAt, saveSnooze, restoreSnooze, oldest, cardCount] =
        await Promise.all([
          metaValue(META.lastSyncedAt),
          metaValue(META.lastSyncFailedAt),
          metaValue(META.saveReminderSnoozedUntil),
          metaValue(META.restoreOfferSnoozedUntil),
          db.outbox.orderBy('queuedAt').first(),
          db.cards.count(),
        ]);
      return {
        saveReminder: shouldRemindToSave({
          now,
          lastSyncedAt,
          oldestUnsentAt: oldest?.queuedAt ?? null,
          snoozedUntil: saveSnooze,
        }),
        restoreOffer: shouldOfferRestore({
          now,
          cardCount,
          lastSyncedAt,
          lastSyncFailed: lastSyncFailedAt !== null,
          snoozedUntil: restoreSnooze,
        }),
      };
    },

    /** "Not now" (or a saved copy): that modal waits 7 days. Device-only, never synced. */
    async snoozeBackup(kind: 'save' | 'restore'): Promise<void> {
      const key = kind === 'save' ? META.saveReminderSnoozedUntil : META.restoreOfferSnoozedUntil;
      await db.meta.put({ key, value: snoozeUntil(deps.now()) });
    },

    /** Everything in this account's box, deleted rows too, as one backup (ADR-016). */
    async exportBackup(userId: string): Promise<Backup> {
      const [profile, cards, entries, reviewLogs, streakDays] = await Promise.all([
        db.profile.toCollection().first(),
        db.cards.toArray(),
        db.entries.toArray(),
        db.reviewLogs.toArray(),
        db.streakDays.toArray(),
      ]);
      return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: deps.now(),
        userId,
        profile: profile ? { displayName: profile.displayName, timeZone: profile.timeZone } : null,
        // wordKey is device-only (worked out again on import).
        cards: cards.map((card) => ({
          id: card.id,
          word: card.word,
          deck: card.deck,
          addedOn: card.addedOn,
          box: card.box,
          dueDate: card.dueDate,
          masteredAt: card.masteredAt,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          deletedAt: card.deletedAt,
        })),
        entries: entries.map((entry) => ({ ...entry, translation: entry.translation ?? null })),
        reviewLogs: reviewLogs.map((log) => ({ ...log, typedAnswer: log.typedAnswer ?? null })),
        streakDays,
      };
    },

    /**
     * Put a backup into this box (ADR-016). Merges with what is there, using the sync rules:
     * the newer edit of a row wins, review logs and streak days are only added, and a word
     * that already exists under another card keeps that card (lists combined, history moved).
     * All or nothing; everything it changes is queued for the cloud. Importing twice changes nothing.
     */
    importBackup(backup: Backup, userId: string): Promise<ImportResult> {
      if (backup.userId !== userId) return Promise.resolve({ status: 'otherAccount' });
      return db.transaction('rw', ALL_TABLES, async () => {
        const now = deps.now();
        let wordsAdded = 0;
        let wordsUpdated = 0;

        if (backup.profile && !(await db.profile.get(userId))) {
          // The phone lost its copy too: bring back the name and time zone ("today").
          await db.profile.put({ userId, ...backup.profile, updatedAt: now });
        }

        /** Backup card id → the card id on this device (differs for a merged duplicate word). */
        const target = new Map<string, string>();
        const mergedInto = new Map<string, string>();
        for (const card of backup.cards) {
          const row: CardRow = { ...card, wordKey: wordKey(card.word) };
          const local = await db.cards.get(card.id);
          const same =
            local || card.deletedAt !== null ? undefined : await findByWord(card.word, card.deck);
          if (same) {
            target.set(card.id, same.id);
            mergedInto.set(card.id, same.id);
            continue;
          }
          target.set(card.id, card.id);
          if (!remoteWins(local, row)) continue;
          await db.cards.put(row);
          await queue('cards', card.id, now);
          if (card.deletedAt !== null) continue;
          if (local) wordsUpdated += 1;
          else wordsAdded += 1;
        }

        const byCard = new Map<string, BackupEntry[]>();
        for (const entry of backup.entries) {
          if (mergedInto.has(entry.cardId)) {
            byCard.set(entry.cardId, [...(byCard.get(entry.cardId) ?? []), entry]);
          } else if (remoteWins(await db.entries.get(entry.id), entry)) {
            await db.entries.put(entry);
            await queue('entries', entry.id, now);
          }
        }
        for (const [cardId, entries] of byCard) {
          const existing = mergedInto.get(cardId)!;
          const plan = planEntryMerge(await liveEntries(existing), entries);
          for (const { entry, position } of plan.move) {
            if (await db.entries.get(entry.id)) continue;
            await db.entries.put({ ...entry, cardId: existing, position, updatedAt: now });
            await queue('entries', entry.id, now);
          }
        }

        for (const log of backup.reviewLogs) {
          if (await db.reviewLogs.get(log.id)) continue;
          await db.reviewLogs.add({ ...log, cardId: target.get(log.cardId)! });
          await queue('reviewLogs', log.id, now);
        }
        for (const day of backup.streakDays) {
          if (await db.streakDays.get(day.day)) continue;
          await db.streakDays.add(day);
          await queue('streakDays', day.day, now);
        }
        return { status: 'imported', wordsAdded, wordsUpdated };
      });
    },

    /** Cards still to review today in every enabled deck, each within its daily limit: the app icon number. */
    async waitingToday(): Promise<number> {
      const statuses = await deckStatusesOf(enabledDecks().map((deck) => deck.id));
      return statuses.reduce((sum, status) => sum + status.waiting, 0);
    },

    /** Should "Want a daily reminder?" be offered on this device? (Not after yes, nor during "Not now".) */
    async reminderOfferOpen(): Promise<boolean> {
      const state = (await db.meta.get(META.reminderOffer))?.value as string | undefined;
      if (state === undefined) return true;
      if (state === 'done') return false;
      return Date.parse(deps.now()) >= Date.parse(state);
    },

    /** "done": reminders are on (never ask again here). "snooze": "Not now", ask again in 7 days. */
    async closeReminderOffer(how: 'done' | 'snooze'): Promise<void> {
      const value = how === 'done' ? 'done' : snoozeUntil(deps.now());
      await db.meta.put({ key: META.reminderOffer, value });
    },

    /** Words learned and the streak, for the top bar, Loading and Session complete. */
    async progress(): Promise<Progress> {
      const now = deps.now();
      // All reads start before the first await, so useLiveQuery refreshes on each change.
      const [profile, box1Logs, days] = await Promise.all([
        db.profile.toCollection().first(),
        db.reviewLogs.where('boxBefore').equals(1).toArray(),
        db.streakDays.toCollection().primaryKeys(),
      ]);
      const today = dateInZone(now, resolveTimeZone(profile?.timeZone));
      return { wordsLearned: wordsLearned(box1Logs), streak: currentStreak(days, today) };
    },

    /** The card ids for the next session; empty means "All done for today". */
    async nextSessionCardIds(): Promise<string[]> {
      const now = deps.now();
      // Every read starts before the first await, so useLiveQuery sees all of them and
      // refreshes after each answer. (Dexie only tracks reads that start inside its live
      // query; awaiting a plain async helper first would hide the later ones.)
      const [profile, maybeDue, recent] = await Promise.all([
        db.profile.toCollection().first(),
        maybeDueCards(now),
        recentLogs(now),
      ]);
      const zone = resolveTimeZone(profile?.timeZone);
      const date = dateInZone(now, zone);
      const due = maybeDue.filter((card) => isOnOrBefore(card.dueDate, date));
      return pickSessionCards(due, reviewsDoneToday(recent, now, zone), date);
    },

    /** Each deck's state for the Today screen. Read with useLiveQuery. */
    deckStatuses(decks: readonly DeckId[]): Promise<DeckStatus[]> {
      return deckStatusesOf(decks);
    },

    /**
     * Start (or continue) today's session of a deck (v3 brief 1.6). A session left half way
     * today carries on where it stopped; otherwise the next cards are picked and saved.
     * Null when nothing is due.
     */
    openDeckSession(deck: DeckId): Promise<Session | null> {
      return db.transaction('rw', [db.profile, db.cards, db.reviewLogs, db.meta], async () => {
        const now = deps.now();
        const zone = await timeZone();
        const date = dateInZone(now, zone);
        const key = `${META.sessionOf}${deck}`;
        const recent = await recentLogs(now);
        const todayLogs = recent.filter((log) => dateInZone(log.reviewedAt, zone) === date);

        const saved = (await db.meta.get(key))?.value as SavedSession | undefined;
        if (saved && saved.date === date) {
          const session = resumeSession(saved.scheduled, todayLogs);
          if (session.answered < session.scheduled.length + session.practice.length) return session;
        }

        const deckCards = await db.cards.where('deck').equals(deck).primaryKeys();
        const inDeck = new Set(deckCards);
        const due = (await maybeDueCards(now)).filter(
          (card) => card.deck === deck && isOnOrBefore(card.dueDate, date),
        );
        const reviews = reviewsDoneToday(
          recent.filter((log) => inDeck.has(log.cardId)),
          now,
          zone,
        );
        const scheduled = pickSessionCards(due, reviews, date, deck);
        if (scheduled.length === 0) {
          await db.meta.delete(key);
          return null;
        }
        await db.meta.put({ key, value: { date, scheduled } satisfies SavedSession });
        return resumeSession(scheduled, []);
      });
    },

    /**
     * "Mix them all" (v3 brief 1.5): each deck's real session (its own size and daily limit),
     * mixed in random chunks of 3–9. A mix left half way today carries on where it stopped.
     * Null when nothing is due in any of `decks`.
     */
    openMixSession(
      decks: readonly DeckId[],
      random: Random = Math.random,
    ): Promise<MixSession | null> {
      return db.transaction('rw', [db.profile, db.cards, db.reviewLogs, db.meta], async () => {
        const now = deps.now();
        const zone = await timeZone();
        const date = dateInZone(now, zone);
        const recent = await recentLogs(now);
        const todayLogs = recent.filter((log) => dateInZone(log.reviewedAt, zone) === date);
        const withDecks = async (session: Session): Promise<MixSession> => {
          const cards = await db.cards.bulkGet([...session.scheduled]);
          const deckOf: Record<string, DeckId> = {};
          for (const card of cards) if (card) deckOf[card.id] = card.deck;
          return { session, deckOf };
        };

        const saved = (await db.meta.get(META.mixSession))?.value as SavedSession | undefined;
        if (saved && saved.date === date) {
          const session = resumeSession(saved.scheduled, todayLogs);
          if (session.answered < session.scheduled.length + session.practice.length) {
            return withDecks(session);
          }
        }

        const due = (await maybeDueCards(now)).filter((card) => isOnOrBefore(card.dueDate, date));
        const queues = [];
        for (const deck of decks) {
          const inDeck = new Set(await db.cards.where('deck').equals(deck).primaryKeys());
          const reviews = reviewsDoneToday(
            recent.filter((log) => inDeck.has(log.cardId)),
            now,
            zone,
          );
          const deckDue = due.filter((card) => card.deck === deck);
          queues.push({ deck, cardIds: pickSessionCards(deckDue, reviews, date, deck) });
        }
        const scheduled = mixDecks(queues, random);
        if (scheduled.length === 0) {
          await db.meta.delete(META.mixSession);
          return null;
        }
        await db.meta.put({
          key: META.mixSession,
          value: { date, scheduled } satisfies SavedSession,
        });
        return withDecks(resumeSession(scheduled, []));
      });
    },

    /**
     * The live cards of `decks` added (or re-added with "Save & start over") on `date`, in the
     * profile time zone; today when no date is given. Extra practice runs these (v3 brief 1.7).
     */
    async cardsAddedOn(
      decks: readonly DeckId[],
      date?: string,
    ): Promise<{ id: string; deck: DeckId }[]> {
      const day = date ?? (await today(deps.now()));
      const cards = await db.cards.where('addedOn').equals(day).toArray();
      return cards
        .filter((card) => card.deletedAt === null && decks.includes(card.deck))
        .map((card) => ({ id: card.id, deck: card.deck }));
    },

    /** Today, in the profile time zone (YYYY-MM-DD). */
    async todayDate(): Promise<string> {
      return today(deps.now());
    },

    /** Cards left in today's "Mix them all" left half way; null when there is none. */
    async mixPausedLeft(): Promise<number | null> {
      const now = deps.now();
      const [profile, saved, recent] = await Promise.all([
        db.profile.toCollection().first(),
        db.meta.get(META.mixSession),
        recentLogs(now),
      ]);
      const zone = resolveTimeZone(profile?.timeZone);
      const date = dateInZone(now, zone);
      const value = saved?.value as SavedSession | undefined;
      if (!value || value.date !== date) return null;
      const todayLogs = recent.filter((log) => dateInZone(log.reviewedAt, zone) === date);
      const session = resumeSession(value.scheduled, todayLogs);
      const left = session.scheduled.length + session.practice.length - session.answered;
      return left > 0 && session.answered > 0 ? left : null;
    },

    /** The mixed session is finished: forget it. */
    async closeMixSession(): Promise<void> {
      await db.meta.delete(META.mixSession);
    },

    /** The session of a deck is finished: forget it, so the deck no longer says "Paused". */
    async closeDeckSession(deck: DeckId): Promise<void> {
      await db.meta.delete(`${META.sessionOf}${deck}`);
    },
  };

  /** Live cards due by the latest "today" anywhere on Earth; narrow to the profile's day after. */
  function maybeDueCards(now: string) {
    return db.cards
      .where('dueDate')
      .belowOrEqual(dateInZone(now, LATEST_TIME_ZONE))
      .filter((card) => card.deletedAt === null)
      .toArray();
  }

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
      translation: input.translation ?? null,
      position,
      updatedAt: now,
      deletedAt: null,
    });
    await queue('entries', id, now);
  }
}

export type Repository = ReturnType<typeof createRepository>;
