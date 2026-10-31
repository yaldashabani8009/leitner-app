import type { Deck } from '../domain/decks/decks';
import { DeckIcon } from './DeckIcon';
import styles from './DeckChip.module.css';

interface DeckChipProps {
  deck: Deck;
  /**
   * "sheet": cream, in the add sheet's header (canvas N4).
   * "session": white with the full outline, next to the progress bar in Mix them all (N6).
   */
  variant?: 'sheet' | 'session';
}

/** A small chip with the deck's icon and name. */
export function DeckChip({ deck, variant = 'sheet' }: DeckChipProps) {
  return (
    <span className={`${styles.chip} ${styles[variant]}`}>
      <DeckIcon icon={deck.icon} size={16} strokeWidth={2.2} />
      {deck.label}
    </span>
  );
}
