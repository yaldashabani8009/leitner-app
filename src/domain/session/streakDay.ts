/**
 * Does today count for the streak? (Yali's decision, 2026-10-28; the streak itself is roadmap 7.11.)
 * A day counts when any one is true:
 * 1. 20 scheduled reviews were done (across any number of sessions and ALL decks);
 * 2. fewer were due, and every due card (in all decks) was reviewed;
 * 3. no cards were due at all, and a new card was added.
 * The streak is shared: `studiedToday` adds up every study area, `dayCountsForStreak` decides.
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

/**
 * "How much did you study today, across all areas": adds up one StreakDay per deck (or any
 * future area, e.g. grammar). Feed the result to `dayCountsForStreak`.
 */
export function studiedToday(areas: readonly StreakDay[]): StreakDay {
  return areas.reduce<StreakDay>(
    (total, area) => ({
      scheduledReviews: total.scheduledReviews + area.scheduledReviews,
      cardsStillDue: total.cardsStillDue + area.cardsStillDue,
      wordsAdded: total.wordsAdded + area.wordsAdded,
    }),
    { scheduledReviews: 0, cardsStillDue: 0, wordsAdded: 0 },
  );
}
