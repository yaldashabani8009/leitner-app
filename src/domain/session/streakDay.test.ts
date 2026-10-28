import { describe, expect, it } from 'vitest';
import { dayCountsForStreak } from './streakDay';

describe('dayCountsForStreak (Q2: option C plus the small-day rules)', () => {
  it.each([
    // [label, scheduledReviews, cardsStillDue, wordsAdded, counts]
    ['20 reviews done, more still due', 20, 15, 0, true],
    ['20 reviews over several sessions, none left', 20, 0, 0, true],
    ['45 reviews done', 45, 0, 0, true],
    ['19 reviews done, more still due', 19, 6, 0, false],
    ['7 due, all 7 reviewed', 7, 0, 0, true],
    ['15 due, only 10 reviewed', 10, 5, 0, false],
    ['nothing due, a new word added', 0, 0, 1, true],
    ['nothing due, nothing added', 0, 0, 0, false],
    ['cards due, none reviewed, a word added', 0, 4, 1, false],
  ] as const)('%s → %s', (_label, scheduledReviews, cardsStillDue, wordsAdded, counts) => {
    expect(dayCountsForStreak({ scheduledReviews, cardsStillDue, wordsAdded })).toBe(counts);
  });
});
