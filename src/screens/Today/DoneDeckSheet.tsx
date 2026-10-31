import type { Deck } from '../../domain/decks/decks';
import { DeckIcon } from '../../ui/DeckIcon';
import { PlusIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import styles from './DoneDeckSheet.module.css';

interface DoneDeckSheetProps {
  /** The finished deck that was tapped; null = closed. */
  deck: Deck | null;
  onClose: () => void;
  onAdd: (deck: Deck) => void;
}

/**
 * Tapping a finished deck (canvas N3): a small sheet with "Add …". Roadmap 11.7 adds
 * "Practice today's new words" above it, when words were added to the deck today.
 */
export function DoneDeckSheet({ deck, onClose, onAdd }: DoneDeckSheetProps) {
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
      {deck && (
        <button type="button" className={styles.add} onClick={() => onAdd(deck)}>
          <PlusIcon size={20} />
          Add {deck.label.toLowerCase()}
        </button>
      )}
    </Sheet>
  );
}
