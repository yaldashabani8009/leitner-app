/**
 * The two top-bar numbers (PRD "Streak and progress", roadmap 7.11). Pure: the caller passes
 * the review logs, the earned streak days and "today" in the profile time zone.
 */

import type { Box } from '../leitner/config';
import { addDays, type CalendarDate } from '../time/calendarDate';

export interface LearnedReview {
  readonly cardId: string;
  readonly correct: boolean;
  readonly boxBefore: Box;
  readonly isPractice: boolean;
}

/**
 * Words learned: cards that have passed box 1 at least once (a scheduled "Knew it!" in box 1).
 * Counted from the append-only review logs, so it never goes down, even when the duplicate
 * rule or a "Not yet" sends the card back to box 1.
 */
export function wordsLearned(logs: Iterable<LearnedReview>): number {
  const passed = new Set<string>();
  for (const log of logs) {
    if (log.correct && log.boxBefore === 1 && !log.isPractice) passed.add(log.cardId);
  }
  return passed.size;
}

/**
 * Days in a row that earned the streak (see streakDay.ts for when a day counts).
 * Until today is earned the streak still shows the run up to yesterday, so it doesn't drop
 * to 0 every morning (Yali's decision, 2026-10-29); a whole missed day resets it.
 */
export function currentStreak(earnedDays: Iterable<CalendarDate>, today: CalendarDate): number {
  const earned = new Set(earnedDays);
  let day = earned.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (earned.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
