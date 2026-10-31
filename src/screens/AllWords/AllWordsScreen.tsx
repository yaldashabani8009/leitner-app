import { enabledDecks, type Deck } from '../../domain/decks/decks';
import { AddButton } from '../../ui/AddButton';
import { IconButton } from '../../ui/IconButton';
import { BackIcon } from '../../ui/icons';
import { Mascot } from '../../ui/Mascot/Mascot';
import styles from './AllWordsScreen.module.css';

export interface AllWordsRow {
  id: string;
  word: string;
}

interface AllWordsScreenProps {
  /** Live cards in every deck, newest first. Undefined while loading. */
  cards: readonly AllWordsRow[] | undefined;
  onBack: () => void;
  onAdd: (deck: Deck) => void;
}

/**
 * "In your box" (v3 brief 1.9), opened from the top-bar box badge. Roadmap 11.3 ships this
 * first version: the header and the plain list. 11.8 adds deck chips, search, sorts,
 * progress dots, swipe-to-delete and a virtualised list.
 */
export function AllWordsScreen({ cards, onBack, onAdd }: AllWordsScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <IconButton
          label="Back"
          variant="white"
          icon={<BackIcon size={20} />}
          onClick={onBack}
          className={styles.back}
        />
        <div className={styles.heading}>
          <h1 className={styles.title}>In your box</h1>
          {cards !== undefined && (
            <span className={styles.total}>
              {cards.length === 1 ? '1 card' : `${cards.length} cards`}
            </span>
          )}
        </div>
        <AddButton decks={enabledDecks()} onPick={onAdd} />
      </header>
      {cards !== undefined && cards.length === 0 && (
        <div className={styles.empty}>
          <Mascot pose="idle" decorative />
          <p className={styles.emptyTitle}>Your box is empty</p>
        </div>
      )}
      {cards !== undefined && cards.length > 0 && (
        <ul className={styles.list}>
          {cards.map((card) => (
            <li key={card.id} className={styles.row}>
              {card.word}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
