import { describe, expect, it } from 'vitest';
import { DECK_IDS, DECK_LIMITS } from '../leitner/config';
import { DECKS, deckById, deckOrVocab, enabledDecks, isDeckId, type Deck } from './decks';

describe('deck registry', () => {
  it('has exactly one entry per deck id, with that deck’s limits', () => {
    expect(DECKS.map((d) => d.id)).toEqual([...DECK_IDS]);
    for (const deck of DECKS) expect(deck.limits).toBe(DECK_LIMITS[deck.id]);
  });

  it('uses the limits from the brief', () => {
    expect(DECK_LIMITS).toEqual({
      vocab: { sessionSize: 20, dailyLimit: 100 },
      spelling: { sessionSize: 30, dailyLimit: 250 },
      phrases: { sessionSize: 10, dailyLimit: 30 },
    });
  });

  it('colours are token names, never raw values', () => {
    for (const deck of DECKS) {
      expect(deck.edgeColor).toMatch(/^--color-/);
      expect(deck.tileColor).toMatch(/^--color-/);
    }
  });

  it('only vocab is enabled for now', () => {
    expect(enabledDecks().map((d) => d.id)).toEqual(['vocab']);
  });

  it('works with every deck enabled (test fixture)', () => {
    const all: Deck[] = DECKS.map((d) => ({ ...d, enabled: true }));
    expect(enabledDecks(all).map((d) => d.id)).toEqual(['vocab', 'spelling', 'phrases']);
  });

  it('finds a deck by id, and throws for an id missing from the list', () => {
    expect(deckById('spelling').label).toBe('Spelling');
    expect(() => deckById('phrases', [])).toThrow('Unknown deck');
  });

  it('treats unknown or missing decks as vocab (old cloud rows, v1 backups)', () => {
    expect(isDeckId('phrases')).toBe(true);
    expect(isDeckId('grammar')).toBe(false);
    expect(deckOrVocab('spelling')).toBe('spelling');
    expect(deckOrVocab(undefined)).toBe('vocab');
    expect(deckOrVocab(null)).toBe('vocab');
    expect(deckOrVocab('nonsense')).toBe('vocab');
  });
});
