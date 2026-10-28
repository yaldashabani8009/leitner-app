/**
 * Does today count for the streak? (Yali's decision, 2026-10-28; the streak itself is roadmap 7.11.)
 * A day counts when any one is true:
 * 1. 20 scheduled reviews were done (across any number of sessions);
 * 2. fewer were due, and every due card was reviewed;
 * 3. no cards were due at all, and a new word was added.
 */

import { STREAK_DAILY_REVIEWS } from '../leitner/config';

export interface StreakDay {
  /** Scheduled reviews done today (practice never counts). */
  readonly scheduledReviews: number;
  /** Cards still due today right now. */
  readonly cardsStillDue: number;
  /** New words added today. */
  readonly wordsAdded: number;
}

export function dayCountsForStreak(day: StreakDay): boolean {
  if (day.scheduledReviews >= STREAK_DAILY_REVIEWS) return true;
  if (day.cardsStillDue > 0) return false;
  return day.scheduledReviews > 0 || day.wordsAdded > 0;
}
