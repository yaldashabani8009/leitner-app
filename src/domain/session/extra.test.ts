import { describe, expect, it } from 'vitest';
import { missedInRound, practiceOrder, type PracticeCard } from './extra';
import { seededRandom } from './mix';

const cards = (deck: PracticeCard['deck'], prefix: string, count: number): PracticeCard[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, deck }));

describe('practiceOrder (v3 brief 1.7)', () => {
  it('each card once, shuffled again every round', () => {
    const vocab = cards('vocab', 'v', 12);
    const random = seededRandom(5);
    const first = practiceOrder(vocab, random);
    const second = practiceOrder(vocab, random);
    expect(new Set(first)).toEqual(new Set(vocab.map((c) => c.id)));
    expect(first).toHaveLength(12);
    expect(second).not.toEqual(first);
  });

  it('mixed decks come in chunks by deck', () => {
    const order = practiceOrder(
      [...cards('vocab', 'v', 10), ...cards('spelling', 's', 10)],
      seededRandom(2),
    );
    expect(order).toHaveLength(20);
    // The first chunk is at least 3 cards of one deck.
    expect(new Set(order.slice(0, 3).map((id) => id[0])).size).toBe(1);
  });

  it('nothing added → nothing to practise', () => {
    expect(practiceOrder([], seededRandom(1))).toEqual([]);
  });
});

describe('missedInRound (N12)', () => {
  it('keeps the missed ones in the order they came', () => {
    const answers = new Map([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);
    expect(missedInRound(['c', 'a', 'b', 'd'], answers)).toEqual(['c', 'b']);
  });
});
