/**
 * "Mix them all" (v3 brief 1.5, canvas N6): the real sessions of every deck with cards due, in
 * one stream. Cards from different decks come in random chunks of 3 to 9, each chunk shuffled.
 * Pure: the caller passes the random source (Math.random in the app, a seeded one in tests).
 */

import type { DeckId } from '../leitner/config';

export const MIX_CHUNK_MIN = 3;
export const MIX_CHUNK_MAX = 9;

/** A number in [0, 1), like Math.random. */
export type Random = () => number;

export interface DeckQueue {
  readonly deck: DeckId;
  /** The deck's own session, already picked with its session size and daily limit. */
  readonly cardIds: readonly string[];
}

/**
 * How many cards the next chunk takes from a deck with `left` cards: 3 to 9, but never leaving
 * 1 or 2 behind (they would make a tiny chunk later). A deck with fewer than 3 cards gives them all.
 */
export function chunkSize(left: number, random: Random): number {
  if (left < MIX_CHUNK_MIN) return left;
  const sizes: number[] = [];
  for (let size = MIX_CHUNK_MIN; size <= Math.min(MIX_CHUNK_MAX, left); size++) {
    const rest = left - size;
    if (rest === 0 || rest >= MIX_CHUNK_MIN) sizes.push(size);
  }
  return sizes[Math.floor(random() * sizes.length)];
}

/** Fisher–Yates. */
function shuffle<T>(items: T[], random: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * The mixed order. A deck is drawn at random (never the same twice in a row while another deck
 * still has cards), then its next 3–9 cards (see chunkSize), shuffled. Every card appears exactly once.
 */
export function mixDecks(queues: readonly DeckQueue[], random: Random): string[] {
  const left = queues
    .filter((queue) => queue.cardIds.length > 0)
    .map((queue) => ({ deck: queue.deck, ids: [...queue.cardIds] }));
  const mixed: string[] = [];
  let last: DeckId | null = null;
  while (left.length > 0) {
    const others = left.filter((queue) => queue.deck !== last);
    const choices = others.length > 0 ? others : left;
    const queue = choices[Math.floor(random() * choices.length)];
    const size = chunkSize(queue.ids.length, random);
    mixed.push(...shuffle(queue.ids.splice(0, size), random));
    last = queue.deck;
    if (queue.ids.length === 0) left.splice(left.indexOf(queue), 1);
  }
  return mixed;
}

/** A small seeded random source (mulberry32), so tests and replays get the same mix. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
