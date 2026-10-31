import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Box } from '../leitner/config';
import { answer } from '../leitner/engine';
import { pickSessionCards, reviewsDoneToday, type LoggedReview, type SessionCard } from './pick';

const TODAY = '2026-03-10';
const NOW = '2026-03-10T08:00:00.000Z';

function card(id: string, dueDate = TODAY, box: Box = 1, masteredAt: string | null = null) {
  return { id, dueDate, box, masteredAt } satisfies SessionCard;
}

/** `count` cards all due today in box 1: c00, c01, … */
function dueCards(count: number, dueDate = TODAY): SessionCard[] {
  return Array.from({ length: count }, (_, i) => card(`c${String(i).padStart(2, '0')}`, dueDate));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('pickSessionCards: session size (rule 1)', () => {
  it.each([
    [25, 20],
    [20, 20],
    [7, 7],
    [0, 0],
  ])('%i due → %i picked', (due, picked) => {
    expect(pickSessionCards(dueCards(due), 0, TODAY)).toHaveLength(picked);
  });

  it('opening again the same day gives the next 20', () => {
    let cards = dueCards(45);
    const sessions: string[][] = [];
    for (let done = 0; done < 60; done += 20) {
      const ids = pickSessionCards(cards, done, TODAY);
      sessions.push(ids);
      // Answer them all right: they move on and are no longer due today.
      cards = cards.map((c) =>
        ids.includes(c.id) ? { ...c, ...answer(c, true, TODAY, NOW).schedule } : c,
      );
    }
    expect(sessions.map((s) => s.length)).toEqual([20, 20, 5]);
    expect(new Set(sessions.flat()).size).toBe(45); // never the same card twice
  });
});

describe('pickSessionCards: daily cap of 100 (rules 2–3)', () => {
  it.each([
    [0, 20],
    [80, 20],
    [90, 10],
    [95, 5],
    [99, 1],
    [100, 0],
    [120, 0],
  ])('%i reviews already done today → %i picked', (done, picked) => {
    expect(pickSessionCards(dueCards(30), done, TODAY)).toHaveLength(picked);
  });

  it('leftovers roll over: tomorrow the remaining cards are picked again', () => {
    const cards = dueCards(30);
    expect(pickSessionCards(cards, 100, TODAY)).toEqual([]);
    expect(pickSessionCards(cards, 0, '2026-03-11')).toHaveLength(20);
  });
});

describe('pickSessionCards: what is never picked', () => {
  it('skips cards not due yet and mastered cards', () => {
    const cards = [
      card('due'),
      card('tomorrow', '2026-03-11'),
      card('mastered', '2026-03-01', 5, '2026-03-01T09:00:00Z'),
    ];
    expect(pickSessionCards(cards, 0, TODAY)).toEqual(['due']);
  });

  it('cards that are due but leftover stay due (nothing moves by itself)', () => {
    const cards = dueCards(25);
    pickSessionCards(cards, 0, TODAY);
    expect(pickSessionCards(cards, 0, TODAY)).toHaveLength(20);
  });
});

describe('pickSessionCards: order (rule 4)', () => {
  it('most overdue first, then lowest box', () => {
    const cards = [
      card('today-box3', TODAY, 3),
      card('week-ago-box4', '2026-03-03', 4),
      card('today-box1', TODAY, 1),
      card('yesterday-box2', '2026-03-09', 2),
      card('week-ago-box2', '2026-03-03', 2),
    ];
    expect(pickSessionCards(cards, 0, TODAY)).toEqual([
      'week-ago-box2',
      'week-ago-box4',
      'yesterday-box2',
      'today-box1',
      'today-box3',
    ]);
  });

  it('most overdue cards win the 20 places', () => {
    const old = dueCards(5, '2026-02-01').map((c) => ({ ...c, id: `old-${c.id}` }));
    const picked = pickSessionCards([...dueCards(30), ...old], 0, TODAY);
    expect(picked.slice(0, 5).every((id) => id.startsWith('old-'))).toBe(true);
  });
});

describe('pickSessionCards: same due date and box are shuffled per day (Q1 option A)', () => {
  const cards = dueCards(20);
  const idOrder = cards.map((c) => c.id);

  it('is the same order every time on the same day', () => {
    expect(pickSessionCards(cards, 0, TODAY)).toEqual(pickSessionCards(cards, 0, TODAY));
  });

  it('does not depend on the order the cards were added', () => {
    expect(pickSessionCards([...cards].reverse(), 0, TODAY)).toEqual(
      pickSessionCards(cards, 0, TODAY),
    );
  });

  it('is mixed up, not the order the words were added', () => {
    expect(pickSessionCards(cards, 0, TODAY)).not.toEqual(idOrder);
  });

  it('changes from day to day', () => {
    const days = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'];
    const firstCards = days.map((day) => pickSessionCards(dueCards(20, day), 0, day)[0]);
    expect(new Set(firstCards).size).toBeGreaterThan(1);
  });

  it('never lets the shuffle beat the overdue/box order', () => {
    const mixed = [
      ...dueCards(10),
      ...dueCards(10, '2026-03-09').map((c) => ({ ...c, id: `y${c.id}` })),
    ];
    const picked = pickSessionCards(mixed, 0, TODAY);
    expect(picked.slice(0, 10).every((id) => id.startsWith('y'))).toBe(true);
  });
});

describe('reviewsDoneToday', () => {
  const TEHRAN = 'Asia/Tehran';
  const log = (reviewedAt: string, isPractice = false): LoggedReview => ({
    reviewedAt,
    isPractice,
  });

  it('counts scheduled reviews on the profile day only', () => {
    const logs = [
      log('2026-03-10T07:00:00Z'),
      log('2026-03-10T07:01:00Z'),
      log('2026-03-09T07:00:00Z'), // yesterday
    ];
    expect(reviewsDoneToday(logs, NOW, TEHRAN)).toBe(2);
  });

  it('never counts practice answers', () => {
    const logs = [log('2026-03-10T07:00:00Z'), log('2026-03-10T07:05:00Z', true)];
    expect(reviewsDoneToday(logs, NOW, TEHRAN)).toBe(1);
  });

  it('resets at midnight in the profile zone', () => {
    // Tehran midnight = 20:30 UTC.
    const logs = [log('2026-03-09T20:29:00Z'), log('2026-03-09T20:31:00Z')];
    expect(reviewsDoneToday(logs, '2026-03-09T20:35:00Z', TEHRAN)).toBe(1);
    expect(reviewsDoneToday(logs, '2026-03-09T20:20:00Z', TEHRAN)).toBe(1);
  });

  it('follows the profile zone, not the phone', () => {
    const logs = [log('2026-03-09T21:00:00Z'), log('2026-03-10T01:00:00Z')];
    const now = '2026-03-10T02:00:00Z';
    for (const phone of [TEHRAN, 'America/New_York']) {
      vi.stubEnv('TZ', phone);
      expect(reviewsDoneToday(logs, now, TEHRAN)).toBe(2);
      expect(reviewsDoneToday(logs, now, 'America/New_York')).toBe(2);
      expect(reviewsDoneToday([log('2026-03-09T20:00:00Z')], now, TEHRAN)).toBe(0);
      expect(reviewsDoneToday([log('2026-03-09T20:00:00Z')], now, 'America/New_York')).toBe(1);
    }
  });

  it('is 0 with no logs', () => {
    expect(reviewsDoneToday([], NOW, TEHRAN)).toBe(0);
  });
});

describe('per deck: session size and daily limit (v3 brief 1.1)', () => {
  it.each([
    ['vocab', 20],
    ['spelling', 30],
    ['phrases', 10],
  ] as const)('%s picks at most %i', (deck, size) => {
    expect(pickSessionCards(dueCards(400), 0, TODAY, deck)).toHaveLength(size);
  });

  it.each([
    ['vocab', 100],
    ['spelling', 250],
    ['phrases', 30],
  ] as const)('%s stops at its daily limit of %i', (deck, limit) => {
    expect(pickSessionCards(dueCards(400), limit, TODAY, deck)).toEqual([]);
    expect(pickSessionCards(dueCards(400), limit - 3, TODAY, deck)).toHaveLength(3);
  });

  it('counts reviews per deck, and all decks together without a deck', () => {
    const log = (deck?: 'vocab' | 'spelling' | 'phrases', isPractice = false): LoggedReview => ({
      reviewedAt: NOW,
      isPractice,
      deck,
    });
    const logs = [log('vocab'), log(undefined), log('spelling'), log('phrases', true)];
    expect(reviewsDoneToday(logs, NOW, 'UTC', 'vocab')).toBe(2);
    expect(reviewsDoneToday(logs, NOW, 'UTC', 'spelling')).toBe(1);
    expect(reviewsDoneToday(logs, NOW, 'UTC', 'phrases')).toBe(0);
    expect(reviewsDoneToday(logs, NOW, 'UTC')).toBe(3);
  });
});
