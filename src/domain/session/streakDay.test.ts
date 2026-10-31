import { describe, expect, it } from 'vitest';
import { dayCountsForStreak, studiedToday } from './streakDay';

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

describe('studiedToday: one streak across all decks (v3 brief 1.2)', () => {
  it('adds up every area', () => {
    expect(
      studiedToday([
        { scheduledReviews: 12, cardsStillDue: 0, wordsAdded: 1 },
        { scheduledReviews: 8, cardsStillDue: 2, wordsAdded: 0 },
      ]),
    ).toEqual({ scheduledReviews: 20, cardsStillDue: 2, wordsAdded: 1 });
    expect(studiedToday([])).toEqual({ scheduledReviews: 0, cardsStillDue: 0, wordsAdded: 0 });
  });

  it('20 reviews in total across decks earn the day, even with cards still due', () => {
    const day = studiedToday([
      { scheduledReviews: 10, cardsStillDue: 5, wordsAdded: 0 },
      { scheduledReviews: 10, cardsStillDue: 5, wordsAdded: 0 },
    ]);
    expect(dayCountsForStreak(day)).toBe(true);
  });

  it('a card still due in one deck keeps a small day from counting', () => {
    const day = studiedToday([
      { scheduledReviews: 5, cardsStillDue: 0, wordsAdded: 0 },
      { scheduledReviews: 0, cardsStillDue: 3, wordsAdded: 0 },
    ]);
    expect(dayCountsForStreak(day)).toBe(false);
  });

  it('nothing due anywhere and a card added in any deck counts', () => {
    const day = studiedToday([
      { scheduledReviews: 0, cardsStillDue: 0, wordsAdded: 0 },
      { scheduledReviews: 0, cardsStillDue: 0, wordsAdded: 1 },
    ]);
    expect(dayCountsForStreak(day)).toBe(true);
  });
});
