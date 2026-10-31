import type { Deck } from '../domain/decks/decks';
import { DeckIcon } from './DeckIcon';
import styles from './DeckChip.module.css';

/** The small chip in the add sheet's header that shows which deck words go to (canvas N4). */
export function DeckChip({ deck }: { deck: Deck }) {
  return (
    <span className={styles.chip}>
      <DeckIcon icon={deck.icon} size={16} strokeWidth={2.2} />
      {deck.label}
    </span>
  );
}
