/**
 * Which cards go into the next session (PRD "Sessions" rules 1–4).
 * Pure: the caller passes the cards, the review logs, "now"/"today" and the profile zone.
 */

import { isDue, type Schedule } from '../leitner/engine';
import { DECK_LIMITS, type DeckId } from '../leitner/config';
import type { CalendarDate } from '../time/calendarDate';
import { dateInZone } from '../time/zonedDate';

export interface SessionCard extends Schedule {
  readonly id: string;
}

export interface LoggedReview {
  /** UTC ISO timestamp. */
  readonly reviewedAt: string;
  readonly isPractice: boolean;
  /** The deck of the card that was reviewed. Missing (old data) counts as vocab. */
  readonly deck?: DeckId;
}

/**
 * Scheduled reviews done on the profile's "today". Practice answers never count (rule 2).
 * With `deck`, only that deck's reviews; without it, all decks together.
 */
export function reviewsDoneToday(
  logs: readonly LoggedReview[],
  now: string,
  timeZone: string,
  deck?: DeckId,
): number {
  const today = dateInZone(now, timeZone);
  return logs.filter(
    (log) =>
      !log.isPractice &&
      dateInZone(log.reviewedAt, timeZone) === today &&
      (deck === undefined || (log.deck ?? 'vocab') === deck),
  ).length;
}

/** FNV-1a: a small, stable hash so the same day always gives the same shuffle. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The card ids for the next session, in order:
 * most overdue first, then lowest box, then a fixed shuffle for the day (Yali's decision, 2026-10-28).
 * At most the deck's session size, and never past its daily limit (`reviewsToday` = this deck's
 * reviews today). Pass only that deck's cards. Empty → "All done for today".
 */
export function pickSessionCards(
  cards: readonly SessionCard[],
  reviewsToday: number,
  today: CalendarDate,
  deck: DeckId = 'vocab',
): string[] {
  const { sessionSize, dailyLimit } = DECK_LIMITS[deck];
  const room = Math.max(0, Math.min(sessionSize, dailyLimit - reviewsToday));
  // One string key per card; YYYY-MM-DD and zero-padded parts sort correctly as text.
  const sortKey = (card: SessionCard) =>
    `${card.dueDate}|${card.box}|${hash(`${today}:${card.id}`).toString(16).padStart(8, '0')}|${card.id}`;

  return cards
    .filter((card) => isDue(card, today))
    .map((card) => ({ id: card.id, key: sortKey(card) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, room)
    .map((card) => card.id);
}
