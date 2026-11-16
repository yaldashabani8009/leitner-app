import { describe, expect, it } from 'vitest';
import { currentStreak, streakState, wordsLearned, type LearnedReview } from './progress';

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

  it('one missed day is covered by the freeze; two in a row end the run', () => {
    expect(currentStreak(['2026-03-07', '2026-03-08'], TODAY)).toBe(2); // the 9th frozen
    expect(currentStreak(['2026-03-06', '2026-03-07'], TODAY)).toBe(0); // 8th and 9th missed
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

describe('streak freeze (Yali, 2026-11-15, ADR-023)', () => {
  /** Earned days from `from` to `to` (inclusive), leaving out `skip`. */
  function days(from: string, to: string, skip: string[] = []): string[] {
    const out: string[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`);) {
      const day = d.toISOString().slice(0, 10);
      if (!skip.includes(day)) out.push(day);
      d = new Date(d.getTime() + 86_400_000);
    }
    return out;
  }

  it('the freeze covers one missed day; that day is not counted', () => {
    expect(streakState(days('2026-03-01', '2026-03-10', ['2026-03-05']), '2026-03-10')).toEqual({
      streak: 9,
      freezeReady: true, // 5 earned days in a row since: ready again
      frozenDays: ['2026-03-05'],
    });
  });

  it('a second single miss soon after (before 4 days in a row or 7 days) ends the run', () => {
    const earned = days('2026-03-01', '2026-03-10', ['2026-03-04', '2026-03-07']);
    expect(streakState(earned, '2026-03-10')).toEqual({
      streak: 3, // 8, 9, 10
      freezeReady: false,
      frozenDays: [],
    });
  });

  it('4 earned days in a row make it ready again', () => {
    const earned = days('2026-03-01', '2026-03-12', ['2026-03-03', '2026-03-08']);
    // 3rd frozen; 4–7 is 4 days in a row → ready; 8th frozen too.
    expect(streakState(earned, '2026-03-12')).toMatchObject({
      streak: 10,
      frozenDays: ['2026-03-03', '2026-03-08'],
    });
  });

  it('7 days after the frozen day it is ready again, even without 4 days in a row', () => {
    // Frozen on the 3rd; the 6th breaks (2 missed: 6th–7th)… so use a run of 3s instead:
    const earned = ['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05', '2026-03-06'];
    const s1 = streakState(earned, '2026-03-06');
    expect(s1).toMatchObject({ streak: 5, freezeReady: false, frozenDays: ['2026-03-03'] });
    // Still not ready on the 9th (6 days later, run broken by two misses in between).
    expect(streakState([...earned, '2026-03-09'], '2026-03-09').freezeReady).toBe(false);
    // Ready on the 10th: 7 days after the 3rd.
    expect(streakState([...earned, '2026-03-09', '2026-03-10'], '2026-03-10').freezeReady).toBe(
      true,
    );
  });

  it('yesterday missed and today not studied yet: the freeze holds the run for today', () => {
    expect(streakState(['2026-03-07', '2026-03-08'], '2026-03-10')).toEqual({
      streak: 2,
      freezeReady: false,
      frozenDays: ['2026-03-09'],
    });
  });

  it('no run to save: a missed day before any streak is nothing', () => {
    expect(streakState([], '2026-03-10')).toEqual({ streak: 0, freezeReady: true, frozenDays: [] });
    expect(streakState(['2026-03-10'], '2026-03-10').streak).toBe(1);
  });
});
