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
  /** Cards added to this deck today. */
  addedToday: number;
  /**
   * Cards added or missed today (13.3); the practice button shows when > 0. With misses it
   * says "Practice today's words", with new words only "Practice today's new words".
   */
  practiceToday: number;
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
  practiceToday,
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
      {deck && practiceToday > 0 && (
        <button type="button" className={styles.practice} onClick={() => onPractice(deck)}>
          <span className={styles.practiceLabel}>
            <RetryIcon size={20} />
            {practiceToday > addedToday ? "Practice today's words" : "Practice today's new words"}
          </span>
          <span className={styles.count}>{practiceToday}</span>
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
