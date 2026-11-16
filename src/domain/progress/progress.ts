/**
 * The two top-bar numbers (PRD "Streak and progress", roadmap 7.11). Pure: the caller passes
 * the review logs, the earned streak days and "today" in the profile time zone.
 */

import { STREAK_FREEZE_REFILL_DAYS, STREAK_FREEZE_REFILL_RUN, type Box } from '../leitner/config';
import { addDays, isOnOrBefore, type CalendarDate } from '../time/calendarDate';

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

export interface StreakState {
  /** Earned days in the current run (a frozen day keeps the run going but isn't counted). */
  readonly streak: number;
  /** Can the freeze cover the next single missed day? */
  readonly freezeReady: boolean;
  /** Missed days the freeze covered in the current run. */
  readonly frozenDays: readonly CalendarDate[];
}

/**
 * The streak with its automatic freeze (Yali, 2026-11-15, ADR-023), worked out from the earned
 * days alone, from the first one to today:
 * - a single missed day is covered by the freeze when it is ready (the run goes on, the day
 *   isn't counted); two missed days in a row still end the run (the freeze isn't spent then);
 * - a used freeze is ready again 7 days after the day it covered, or after 4 earned days in a row;
 * - today never breaks anything: until it is earned the streak shows the run up to yesterday.
 */
export function streakState(earnedDays: Iterable<CalendarDate>, today: CalendarDate): StreakState {
  const earned = new Set(earnedDays);
  const first = [...earned].sort()[0];
  let streak = 0;
  let freezeReady = true;
  let usedOn: CalendarDate | null = null;
  let run = 0; // earned days in a row since the freeze was used
  let frozenDays: CalendarDate[] = [];
  if (first === undefined) return { streak, freezeReady, frozenDays };

  for (let day = first; isOnOrBefore(day, today); day = addDays(day, 1)) {
    if (earned.has(day)) {
      streak += 1;
      run += 1;
    } else if (day !== today) {
      const next = addDays(day, 1);
      const nextMissedToo = next !== today && !earned.has(next);
      if (streak > 0 && freezeReady && !nextMissedToo) {
        freezeReady = false;
        usedOn = day;
        run = 0;
        frozenDays = [...frozenDays, day];
      } else {
        streak = 0;
        run = 0;
        frozenDays = [];
      }
    }
    if (
      !freezeReady &&
      usedOn !== null &&
      (run >= STREAK_FREEZE_REFILL_RUN ||
        isOnOrBefore(addDays(usedOn, STREAK_FREEZE_REFILL_DAYS), day))
    ) {
      freezeReady = true;
      usedOn = null;
    }
  }
  return { streak, freezeReady, frozenDays };
}

/** Days in a row that earned the streak, with the automatic freeze (see streakState). */
export function currentStreak(earnedDays: Iterable<CalendarDate>, today: CalendarDate): number {
  return streakState(earnedDays, today).streak;
}
