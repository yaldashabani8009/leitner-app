import type { Deck } from '../../domain/decks/decks';
import { DeckIcon } from '../../ui/DeckIcon';
import { PlusIcon, RetryIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import styles from './DoneDeckSheet.module.css';

interface DoneDeckSheetProps {
  /** The finished deck that was tapped; null = closed. */
  deck: Deck | null;
  onClose: () => void;
  onAdd: (deck: Deck) => void;
  /** Cards added to this deck today; "Practice today's new words" shows only when > 0. */
  addedToday: number;
  onPractice: (deck: Deck) => void;
}

/**
 * Tapping a finished deck (canvas N3): "Practice today's new words" (only when words were
 * added to it today) and "Add …".
 */
export function DoneDeckSheet({
  deck,
  onClose,
  onAdd,
  addedToday,
  onPractice,
}: DoneDeckSheetProps) {
  return (
    <Sheet
      open={deck !== null}
      onClose={onClose}
      title={deck?.label ?? ''}
      subtitle="All done for today ✓"
      titleIcon={
        deck && (
          <span className={styles.icon} aria-hidden="true">
            <DeckIcon icon={deck.icon} size={24} />
          </span>
        )
      }
    >
      {deck && addedToday > 0 && (
        <button type="button" className={styles.practice} onClick={() => onPractice(deck)}>
          <span className={styles.practiceLabel}>
            <RetryIcon size={20} />
            Practice today's new words
          </span>
          <span className={styles.count}>{addedToday}</span>
        </button>
      )}
      {deck && (
        <button type="button" className={styles.add} onClick={() => onAdd(deck)}>
          <PlusIcon size={20} />
          Add {deck.label.toLowerCase()}
        </button>
      )}
    </Sheet>
  );
}
