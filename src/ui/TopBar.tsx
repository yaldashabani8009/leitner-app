import { IconButton } from './IconButton';
import { BoxIcon, FlameIcon, PlusIcon } from './icons';
import { Pill } from './Pill';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** Every card in every deck (not deleted; mastered ones included). Hidden when not given. */
  cardCount?: number;
  /** Tapping the box badge opens the all-words page. */
  onOpenBox?: () => void;
  /** Days in a row (PRD streak rule). Hidden when not given. */
  streak?: number;
  /** Opens "add a word". The + is hidden when not given. */
  onAdd?: () => void;
}

function cardCountLabel(count: number): string {
  return count === 1 ? '1 card in your box' : `${count} cards in your box`;
}

/**
 * Two floating pills (the box badge and the streak) and a round + button (v3 brief 1.3).
 * A part that isn't given is left out (the pills while their numbers load);
 * the bar keeps its height so screens don't jump when they arrive.
 */
export function TopBar({ cardCount, onOpenBox, streak, onAdd }: TopBarProps) {
  return (
    <header className={styles.bar}>
      {cardCount !== undefined && (
        <Pill
          variant="stat"
          icon={<BoxIcon />}
          srLabel={cardCountLabel(cardCount)}
          onClick={onOpenBox}
        >
          {cardCount}
        </Pill>
      )}
      {streak !== undefined && (
        <Pill
          variant="stat"
          icon={<FlameIcon />}
          srLabel={streak === 0 ? 'no streak yet' : `${streak}-day streak`}
        >
          {streak}
        </Pill>
      )}
      {onAdd && (
        <IconButton
          label="Add word"
          icon={<PlusIcon size={26} />}
          onClick={onAdd}
          className={styles.add}
        />
      )}
    </header>
  );
}
