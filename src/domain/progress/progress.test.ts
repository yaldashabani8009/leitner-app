import { describe, expect, it } from 'vitest';
import { currentStreak, wordsLearned, type LearnedReview } from './progress';

const log = (cardId: string, overrides: Partial<LearnedReview> = {}): LearnedReview => ({
  cardId,
  correct: true,
  boxBefore: 1,
  isPractice: false,
  ...overrides,
});

describe('wordsLearned (PRD: cards that have passed box 1 at least once)', () => {
  it('is 0 with no reviews', () => {
    expect(wordsLearned([])).toBe(0);
  });

  it('counts a "Knew it!" in box 1', () => {
    expect(wordsLearned([log('a'), log('b')])).toBe(2);
  });

  it('counts each card once, however often it passed box 1', () => {
    expect(wordsLearned([log('a'), log('a', { correct: false }), log('a')])).toBe(1);
  });

  it('never goes down: a later "Not yet" back to box 1 keeps the word learned', () => {
    expect(wordsLearned([log('a'), log('a', { boxBefore: 2, correct: false })])).toBe(1);
  });

  it('ignores "Not yet" in box 1, answers in higher boxes and practice answers', () => {
    expect(
      wordsLearned([
        log('a', { correct: false }),
        log('b', { boxBefore: 3 }),
        log('c', { isPractice: true }),
      ]),
    ).toBe(0);
  });
});

describe('currentStreak', () => {
  const TODAY = '2026-03-10';

  it('is 0 with no earned days', () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it('counts the days in a row ending today', () => {
    expect(currentStreak(['2026-03-08', '2026-03-09', '2026-03-10'], TODAY)).toBe(3);
  });

  it('shows the run up to yesterday while today is not earned yet', () => {
    expect(currentStreak(['2026-03-08', '2026-03-09'], TODAY)).toBe(2);
  });

  it('is 0 after a whole missed day', () => {
    expect(currentStreak(['2026-03-07', '2026-03-08'], TODAY)).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(['2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10'], TODAY)).toBe(2);
  });

  it('runs across month and year ends, in any order, with repeats', () => {
    expect(
      currentStreak(['2027-01-01', '2026-12-31', '2026-12-30', '2027-01-01'], '2027-01-01'),
    ).toBe(3);
  });

  it('ignores days after today (a device clock that was ahead)', () => {
    expect(currentStreak(['2026-03-10', '2026-03-11'], TODAY)).toBe(1);
  });
});
