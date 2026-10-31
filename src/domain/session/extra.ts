/**
 * Extra practice (v3 brief 1.7, canvas N11–N12): the cards added on a day, each once, shuffled
 * again every time. Cards from several decks come in the same random chunks of 3–9 as
 * "Mix them all". Answers never move a card; that is the caller's side (they are logged as
 * practice). Pure: the caller passes the random source.
 */

import type { DeckId } from '../leitner/config';
import { mixDecks, type Random } from './mix';

export interface PracticeCard {
  readonly id: string;
  readonly deck: DeckId;
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The order for one round of extra practice. */
export function practiceOrder(cards: readonly PracticeCard[], random: Random): string[] {
  const byDeck = new Map<DeckId, string[]>();
  for (const card of cards) byDeck.set(card.deck, [...(byDeck.get(card.deck) ?? []), card.id]);
  const queues = [...byDeck].map(([deck, ids]) => ({ deck, cardIds: shuffled(ids, random) }));
  return mixDecks(queues, random);
}

/** Cards missed in a round, in the order they came, for "Practice the 4 again" (N12). */
export function missedInRound(order: readonly string[], answers: ReadonlyMap<string, boolean>) {
  return order.filter((id) => answers.get(id) === false);
}
