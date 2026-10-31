import type { CSSProperties } from 'react';
import type { Deck } from '../domain/decks/decks';
import { DeckIcon } from './DeckIcon';
import styles from './DeckChip.module.css';

interface DeckChipProps {
  deck: Deck;
  /**
   * "sheet": the deck's pale tint, in the add sheet's header (canvas N4 cream, P3 aqua).
   * "session": white with the full outline, next to the progress bar in Mix them all (N6).
   */
  variant?: 'sheet' | 'session';
}

/** A small chip with the deck's icon and name. */
export function DeckChip({ deck, variant = 'sheet' }: DeckChipProps) {
  return (
    <span
      className={`${styles.chip} ${styles[variant]}`}
      style={{ '--tile': `var(${deck.tileColor})` } as CSSProperties}
    >
      <DeckIcon icon={deck.icon} size={16} strokeWidth={2.2} />
      {deck.label}
    </span>
  );
}
