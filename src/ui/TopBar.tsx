import { IconButton } from './IconButton';
import { BookIcon, FlameIcon, PlusIcon } from './icons';
import { Pill } from './Pill';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** Cards that have passed box 1 at least once (PRD: never goes down). Hidden when not given. */
  wordsLearned?: number;
  /** Days in a row (PRD streak rule). Hidden when not given. */
  streak?: number;
  /** Opens "add a word". The + is hidden when not given. */
  onAdd?: () => void;
}

/**
 * Option A from the canvas: two floating pills (words learned, streak) and a round + button.
 * A part that isn't given is left out (the pills while their numbers load);
 * the bar keeps its height so screens don't jump when they arrive.
 */
export function TopBar({ wordsLearned, streak, onAdd }: TopBarProps) {
  return (
    <header className={styles.bar}>
      {wordsLearned !== undefined && (
        <Pill
          variant="stat"
          icon={<BookIcon />}
          srLabel={wordsLearned === 1 ? '1 word learned' : `${wordsLearned} words learned`}
        >
          {wordsLearned}
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
