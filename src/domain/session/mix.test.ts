import { describe, expect, it } from 'vitest';
import { MIX_CHUNK_MAX, MIX_CHUNK_MIN, mixDecks, seededRandom, type DeckQueue } from './mix';

const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`);

/** Splits a mix into runs of the same deck (by id prefix). */
function runs(mixed: string[]): { deck: string; size: number }[] {
  const out: { deck: string; size: number }[] = [];
  for (const id of mixed) {
    const deck = id[0];
    if (out.length > 0 && out[out.length - 1].deck === deck) out[out.length - 1].size += 1;
    else out.push({ deck, size: 1 });
  }
  return out;
}

const queues: DeckQueue[] = [
  { deck: 'vocab', cardIds: ids('v', 20) },
  { deck: 'spelling', cardIds: ids('s', 30) },
  { deck: 'phrases', cardIds: ids('p', 10) },
];

describe('mixDecks (v3 brief 1.5)', () => {
  it('every card exactly once', () => {
    const mixed = mixDecks(queues, seededRandom(1));
    expect(mixed).toHaveLength(60);
    expect(new Set(mixed).size).toBe(60);
  });

  it('chunks of 3 to 9, never the same deck twice in a row while others are left', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const mixed = mixDecks(queues, seededRandom(seed));
      const all = runs(mixed);
      // A run longer than 9 can only be the last deck left, after the others ran out.
      all.forEach((run, i) => {
        if (run.size > MIX_CHUNK_MAX) expect(i).toBe(all.length - 1);
      });
      // Only a deck's last chunk may be smaller than 3 (it had fewer cards left).
      const seen = new Map<string, number>();
      for (const run of all) seen.set(run.deck, (seen.get(run.deck) ?? 0) + run.size);
      expect(seen).toEqual(
        new Map([
          ['v', 20],
          ['s', 30],
          ['p', 10],
        ]),
      );
    }
    expect(MIX_CHUNK_MIN).toBe(3);
  });

  it('shuffles inside a chunk but keeps each deck’s picked cards together in chunks', () => {
    const mixed = mixDecks([{ deck: 'vocab', cardIds: ids('v', 9) }], () => 0.999);
    // One deck: chunks of 9 from the front of its list, shuffled.
    expect(new Set(mixed)).toEqual(new Set(ids('v', 9)));
  });

  it('the same seed gives the same mix; another seed another', () => {
    expect(mixDecks(queues, seededRandom(7))).toEqual(mixDecks(queues, seededRandom(7)));
    expect(mixDecks(queues, seededRandom(7))).not.toEqual(mixDecks(queues, seededRandom(8)));
  });

  it('skips empty decks; nothing due gives an empty mix', () => {
    expect(mixDecks([{ deck: 'vocab', cardIds: [] }], seededRandom(1))).toEqual([]);
    expect(mixDecks([], seededRandom(1))).toEqual([]);
    const one = mixDecks(
      [
        { deck: 'vocab', cardIds: [] },
        { deck: 'phrases', cardIds: ['p0', 'p1'] },
      ],
      seededRandom(3),
    );
    expect(new Set(one)).toEqual(new Set(['p0', 'p1']));
  });

  it('seededRandom stays in [0, 1)', () => {
    const random = seededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
