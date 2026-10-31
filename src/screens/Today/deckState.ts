import type { DeckStatus } from '../../data/repository';

/** The four states of a deck card on Today (v3 brief 1.4). */
export type DeckState = 'paused' | 'due' | 'done' | 'empty';

export function deckState(status: DeckStatus): DeckState {
  if (status.pausedLeft !== null) return 'paused';
  if (status.waiting > 0) return 'due';
  if (status.cardCount === 0) return 'empty';
  return 'done';
}

/** The one status line under the deck's name. */
export function statusLine(status: DeckStatus): string {
  switch (deckState(status)) {
    case 'paused':
      return `Paused · ${status.pausedLeft} left`;
    case 'due':
      return `${status.waiting} waiting`;
    case 'empty':
      return 'Empty';
    case 'done':
      return 'All done for today';
  }
}
