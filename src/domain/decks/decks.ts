/**
 * The deck registry (ADR-019): one entry per deck. Screens loop over `enabledDecks()` instead of
 * hard-coding decks, so a new area (e.g. grammar) plugs in by adding an entry here and its id in
 * `DECK_IDS` (config.ts). Pure data: colours are CSS token names, icons are names the UI maps.
 */

import { DECK_IDS, DECK_LIMITS, type DeckId, type DeckLimits } from '../leitner/config';

export type DeckIcon = 'book' | 'speaker' | 'sparkles';

export interface Deck {
  readonly id: DeckId;
  /** Shown to the user, e.g. in "Already in your Vocab box" and on the deck chip. */
  readonly label: string;
  readonly icon: DeckIcon;
  /** CSS custom-property names from tokens.css (never raw colours). */
  readonly edgeColor: string;
  readonly tileColor: string;
  readonly limits: DeckLimits;
  /** Off until the deck's cards and add form are designed (spelling: step 5, phrases: step 6). */
  readonly enabled: boolean;
}

export const DECKS: readonly Deck[] = [
  {
    id: 'vocab',
    label: 'Vocab',
    icon: 'book',
    edgeColor: '--color-deck-vocab-edge',
    tileColor: '--color-deck-vocab-tile',
    limits: DECK_LIMITS.vocab,
    enabled: true,
  },
  {
    id: 'spelling',
    label: 'Spelling',
    icon: 'speaker',
    edgeColor: '--color-deck-spelling-edge',
    tileColor: '--color-deck-spelling-tile',
    limits: DECK_LIMITS.spelling,
    enabled: false,
  },
  {
    id: 'phrases',
    label: 'Phrases',
    icon: 'sparkles',
    edgeColor: '--color-deck-phrases-edge',
    tileColor: '--color-deck-phrases-tile',
    limits: DECK_LIMITS.phrases,
    enabled: false,
  },
];

/** Every id in DECK_IDS has exactly one entry. */
export function deckById(id: DeckId, decks: readonly Deck[] = DECKS): Deck {
  const deck = decks.find((candidate) => candidate.id === id);
  if (deck === undefined) throw new Error(`Unknown deck: ${id}`);
  return deck;
}

/** The decks the app shows (Today wheel, + roll-out, all-words chips). Tests pass their own list. */
export function enabledDecks(decks: readonly Deck[] = DECKS): readonly Deck[] {
  return decks.filter((deck) => deck.enabled);
}

export function isDeckId(value: unknown): value is DeckId {
  return (DECK_IDS as readonly unknown[]).includes(value);
}

/** Old rows from the cloud or a v1 backup have no deck: they are vocab. */
export function deckOrVocab(value: unknown): DeckId {
  return isDeckId(value) ? value : 'vocab';
}
