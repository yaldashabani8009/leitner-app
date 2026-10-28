import { describe, expect, it } from 'vitest';
import { BOX_GAPS_DAYS, type Box } from './config';
import { answer, isDue, newCard, resetToBox1, type Schedule } from './engine';

const TODAY = '2026-03-10';
const NOW = '2026-03-10T08:15:00.000Z';

function card(box: Box, dueDate = TODAY, masteredAt: string | null = null): Schedule {
  return { box, dueDate, masteredAt };
}

describe('newCard (rule 1)', () => {
  it('starts in box 1, due tomorrow, not mastered', () => {
    expect(newCard(TODAY)).toEqual({ box: 1, dueDate: '2026-03-11', masteredAt: null });
  });

  it('is due tomorrow across month, year and leap-day boundaries', () => {
    expect(newCard('2026-01-31').dueDate).toBe('2026-02-01');
    expect(newCard('2026-12-31').dueDate).toBe('2027-01-01');
    expect(newCard('2028-02-28').dueDate).toBe('2028-02-29');
  });

  it('is not due today, only tomorrow', () => {
    const fresh = newCard(TODAY);
    expect(isDue(fresh, TODAY)).toBe(false);
    expect(isDue(fresh, '2026-03-11')).toBe(true);
  });

  it('rejects a malformed today', () => {
    expect(() => newCard('2026-13-45')).toThrow(RangeError);
  });
});

describe('answer: right (rule 2)', () => {
  it.each([
    [1, 2, '2026-03-12'],
    [2, 3, '2026-03-14'],
    [3, 4, '2026-03-18'],
    [4, 5, '2026-03-26'],
  ] as const)('box %i → box %i, due %s', (from, to, due) => {
    const result = answer(card(from), true, TODAY, NOW);
    expect(result.schedule).toEqual({ box: to, dueDate: due, masteredAt: null });
    expect(result.log).toEqual({ correct: true, boxBefore: from, boxAfter: to });
  });

  it('uses the gaps from config', () => {
    for (const from of [1, 2, 3, 4] as const) {
      const { schedule } = answer(card(from), true, '2026-01-01', NOW);
      const gap = BOX_GAPS_DAYS[from]; // gap of the box the card moves INTO
      expect(schedule.dueDate).toBe(`2026-01-${String(1 + gap).padStart(2, '0')}`);
    }
  });

  it('counts the gap from today, not from the old due date, for an overdue card', () => {
    const overdue = card(2, '2026-02-20');
    expect(answer(overdue, true, TODAY, NOW).schedule.dueDate).toBe('2026-03-14');
  });
});

describe('answer: right in box 5 (rule 3)', () => {
  it('masters the card and logs box_after as null', () => {
    const result = answer(card(5), true, TODAY, NOW);
    expect(result.schedule).toEqual({ box: 5, dueDate: TODAY, masteredAt: NOW });
    expect(result.log).toEqual({ correct: true, boxBefore: 5, boxAfter: null });
  });

  it('a mastered card is never due again, even years later', () => {
    const { schedule } = answer(card(5), true, TODAY, NOW);
    expect(isDue(schedule, TODAY)).toBe(false);
    expect(isDue(schedule, '2030-01-01')).toBe(false);
  });

  it('refuses to answer a card that is already mastered', () => {
    expect(() => answer(card(5, TODAY, NOW), true, TODAY, NOW)).toThrow(/mastered/);
    expect(() => answer(card(5, TODAY, NOW), false, TODAY, NOW)).toThrow(/mastered/);
  });
});

describe('answer: wrong (rule 4)', () => {
  it.each([1, 2, 3, 4, 5] as const)('box %i → box 1, due tomorrow', (from) => {
    const result = answer(card(from), false, TODAY, NOW);
    expect(result.schedule).toEqual({ box: 1, dueDate: '2026-03-11', masteredAt: null });
    expect(result.log).toEqual({ correct: false, boxBefore: from, boxAfter: 1 });
  });

  it('is due tomorrow from today, even when the card was long overdue', () => {
    expect(answer(card(4, '2026-01-01'), false, TODAY, NOW).schedule.dueDate).toBe('2026-03-11');
  });
});

describe('answer: input safety', () => {
  it('rejects a malformed today', () => {
    expect(() => answer(card(1), true, '10/03/2026', NOW)).toThrow(RangeError);
    expect(() => answer(card(1), false, '2026-02-30', NOW)).toThrow(RangeError);
  });

  it('never changes the card it was given', () => {
    const original = card(3, '2026-03-01');
    const copy = { ...original };
    answer(original, true, TODAY, NOW);
    answer(original, false, TODAY, NOW);
    expect(original).toEqual(copy);
  });

  it('gives the same output for the same input', () => {
    expect(answer(card(2), true, TODAY, NOW)).toEqual(answer(card(2), true, TODAY, NOW));
  });
});

describe('isDue (rule 5: missed days move nothing)', () => {
  it.each([
    ['due yesterday', '2026-03-09', true],
    ['due today', '2026-03-10', true],
    ['due 30 days ago', '2026-02-08', true],
    ['due tomorrow', '2026-03-11', false],
  ] as const)('%s → %s', (_label, dueDate, expected) => {
    expect(isDue(card(3, dueDate), TODAY)).toBe(expected);
  });

  it('keeps an overdue card in its box (nothing moves by itself)', () => {
    const overdue = card(4, '2026-01-01');
    isDue(overdue, TODAY);
    expect(overdue.box).toBe(4);
  });

  it('rejects a malformed date', () => {
    expect(() => isDue(card(1), '2026-13-45')).toThrow(RangeError);
  });
});

describe('resetToBox1 (duplicate-word rule)', () => {
  it('sends any card back to box 1, due tomorrow', () => {
    expect(resetToBox1(TODAY)).toEqual({ box: 1, dueDate: '2026-03-11', masteredAt: null });
  });

  it('un-masters a mastered card so it is reviewed again tomorrow (option A)', () => {
    const reset = resetToBox1(TODAY);
    expect(reset.masteredAt).toBeNull();
    expect(isDue(reset, '2026-03-11')).toBe(true);
  });
});

describe('a full journey', () => {
  it('new → mastered in 5 right answers, each on its due day', () => {
    let schedule = newCard('2026-03-10');
    const reviewDays: string[] = [];
    for (let i = 0; i < 5; i++) {
      reviewDays.push(schedule.dueDate);
      schedule = answer(schedule, true, schedule.dueDate, NOW).schedule;
    }
    // Due after 1 day, then the gaps of boxes 2–5: 2, 4, 8 and 16 days.
    expect(reviewDays).toEqual([
      '2026-03-11',
      '2026-03-13',
      '2026-03-17',
      '2026-03-25',
      '2026-04-10',
    ]);
    expect(schedule.masteredAt).toBe(NOW);
  });
});
