/**
 * The Leitner engine (PRD "Leitner algorithm", ADR-009): pure functions, no I/O, no clock.
 * "Today" (a calendar date in the profile time zone) and "now" (a UTC ISO timestamp)
 * are always passed in by the caller.
 */

import { addDays, assertCalendarDate, isOnOrBefore, type CalendarDate } from '../time/calendarDate';
import { BOX_COUNT, gapForBox, type Box } from './config';

/** The scheduling part of a card. Box, due date and mastered are never shown in the UI. */
export interface Schedule {
  readonly box: Box;
  readonly dueDate: CalendarDate;
  /** UTC ISO timestamp when the card was mastered; null while it is still being reviewed. */
  readonly masteredAt: string | null;
}

/** What a scheduled answer did, for the review log. */
export interface AnswerResult {
  readonly schedule: Schedule;
  readonly log: {
    readonly correct: boolean;
    readonly boxBefore: Box;
    /** null = the card is now mastered (matches review_logs.box_after). */
    readonly boxAfter: Box | null;
  };
}

/** Box 1, due tomorrow, not mastered. */
function startOver(today: CalendarDate): Schedule {
  return { box: 1, dueDate: addDays(today, gapForBox(1)), masteredAt: null };
}

/** Rule 1: a new card goes into box 1, due tomorrow. */
export function newCard(today: CalendarDate): Schedule {
  return startOver(today);
}

/**
 * Duplicate-word rule: the existing card goes back to box 1, due tomorrow.
 * A mastered card is un-mastered too (Yali's decision, 2026-10-28).
 */
export function resetToBox1(today: CalendarDate): Schedule {
  return startOver(today);
}

/**
 * Rules 2–4: apply one scheduled answer. Practice answers must not call this (sessions rule 6).
 * - Right: up one box, due today + that box's gap. Right in the last box: mastered.
 * - Wrong: box 1, due tomorrow, from any box.
 */
export function answer(
  card: Schedule,
  correct: boolean,
  today: CalendarDate,
  now: string,
): AnswerResult {
  assertCalendarDate(today);
  if (card.masteredAt !== null) throw new Error('A mastered card is not reviewed in v1.');

  if (!correct) {
    return { schedule: startOver(today), log: { correct, boxBefore: card.box, boxAfter: 1 } };
  }

  if (card.box === BOX_COUNT) {
    return {
      schedule: { box: card.box, dueDate: card.dueDate, masteredAt: now },
      log: { correct, boxBefore: card.box, boxAfter: null },
    };
  }

  const next = (card.box + 1) as Box;
  return {
    schedule: { box: next, dueDate: addDays(today, gapForBox(next)), masteredAt: null },
    log: { correct, boxBefore: card.box, boxAfter: next },
  };
}

/** Rule 5: due on or before today and not mastered. Missed days never move a card. */
export function isDue(card: Schedule, today: CalendarDate): boolean {
  return card.masteredAt === null && isOnOrBefore(card.dueDate, today);
}
