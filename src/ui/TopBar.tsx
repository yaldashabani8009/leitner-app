import { IconButton } from './IconButton';
import { BookIcon, FlameIcon, PlusIcon } from './icons';
import { Pill } from './Pill';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** Cards that have passed box 1 at least once (PRD: never goes down). */
  wordsLearned: number;
  /** Days in a row (PRD streak rule). */
  streak: number;
  onAdd: () => void;
}

/** Option A from the canvas: two floating pills (words learned, streak) and a round + button. */
export function TopBar({ wordsLearned, streak, onAdd }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <Pill
        variant="stat"
        icon={<BookIcon />}
        srLabel={wordsLearned === 1 ? '1 word learned' : `${wordsLearned} words learned`}
      >
        {wordsLearned}
      </Pill>
      <Pill variant="stat" icon={<FlameIcon />} srLabel={`${streak}-day streak`}>
        {streak}
      </Pill>
      <IconButton
        label="Add word"
        icon={<PlusIcon size={26} />}
        onClick={onAdd}
        className={styles.add}
      />
    </header>
  );
}
