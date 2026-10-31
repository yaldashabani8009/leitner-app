/**
 * Leitner configuration. The ONE place the schedule numbers live (PRD: "gaps live in one config value").
 * The engine itself (step 7) is a pure module in this folder: no React, no Dexie, no Supabase imports.
 */

export const BOX_COUNT = 5;

/** Days until the next review once a card has moved INTO this box. Index 0 = box 1. */
export const BOX_GAPS_DAYS = [1, 2, 4, 8, 16] as const;

/** The decks a card can belong to (ADR-019). New areas are added here AND in the deck registry. */
export const DECK_IDS = ['vocab', 'spelling', 'phrases'] as const;
export type DeckId = (typeof DECK_IDS)[number];

export interface DeckLimits {
  /** Most cards in one session of this deck. */
  readonly sessionSize: number;
  /** Most scheduled reviews of this deck in one day. */
  readonly dailyLimit: number;
}

/** Session size and daily limit per deck (v3 brief 1.1). The Leitner boxes and gaps are the same for all. */
export const DECK_LIMITS: Readonly<Record<DeckId, DeckLimits>> = {
  vocab: { sessionSize: 20, dailyLimit: 100 },
  spelling: { sessionSize: 30, dailyLimit: 250 },
  phrases: { sessionSize: 10, dailyLimit: 30 },
};

/** The vocab deck's numbers, kept for callers that only know one deck (the reminder, until 11.9). */
export const SESSION_SIZE = DECK_LIMITS.vocab.sessionSize;
export const DAILY_REVIEW_CAP = DECK_LIMITS.vocab.dailyLimit;

export type Box = 1 | 2 | 3 | 4 | 5;

export function gapForBox(box: Box): number {
  return BOX_GAPS_DAYS[box - 1];
}

/** Scheduled reviews in one day, across ALL decks, that always earn a streak day (Yali's decision, 2026-10-28; v3 brief 1.2). */
export const STREAK_DAILY_REVIEWS = 20;

/** Days without reaching the cloud (with unsent changes) before the "save a copy" modal (7.12). */
export const BACKUP_REMINDER_AFTER_DAYS = 14;
/** After "Not now" or a saved copy, the backup modals wait this long before asking again (7.12). */
export const BACKUP_REMINDER_SNOOZE_DAYS = 7;

/** Daily reminder (Yali, 2026-10-29): from 19:00 in the profile time zone, at most once a day. */
export const DAILY_REMINDER_HOUR = 19;
/** No reminder from this hour on, if the server missed the evening (e.g. it was paused). */
export const DAILY_REMINDER_LAST_HOUR = 23;
