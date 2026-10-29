import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { FlameIcon, PlusIcon } from '../../ui/icons';
import styles from './RestLayout.module.css';
import { RestLayout } from './RestLayout';

interface SessionCompleteProps {
  /** Scheduled cards in the session that just ended (practice repeats not counted). */
  wordCount: number;
  /** Cards still due today and under the daily cap; 0 hides "Next … words" (canvas note 07). */
  nextCount: number;
  onNext: () => void;
  onDone: () => void;
  /** Days in a row, shown in the mascot's speech bubble; hidden while unknown or 0. */
  streak?: number;
  /** Focus "Session complete!" when it appears (the last answer came from the keyboard). */
  focusOnStart?: boolean;
}

/** Celebrating mascot. No score on purpose (decided 2026-10-28). */
export function SessionComplete({
  wordCount,
  nextCount,
  onNext,
  onDone,
  streak,
  focusOnStart = false,
}: SessionCompleteProps) {
  const words = wordCount === 1 ? '1 word' : `${wordCount} words`;
  return (
    <RestLayout
      pose="celebrate"
      panel="orange"
      title="Session complete!"
      text={`You went through ${words}. Nice work.`}
      textIn="stage"
      focusTitle={focusOnStart}
      bubble={
        streak !== undefined &&
        streak > 0 && (
          <>
            <FlameIcon /> {streak === 1 ? '1 day in a row!' : `${streak} days in a row!`}
          </>
        )
      }
      actions={
        <>
          {/* Nothing else due: one real button, not a lone link in an empty panel (Yali, 2026-10-29). */}
          {nextCount > 0 ? (
            <>
              <Button variant="aqua" onClick={onNext}>
                {nextCount === 1 ? 'Next word' : `Next ${nextCount} words`}
              </Button>
              <Button variant="text" onClick={onDone}>
                I'm done for now
              </Button>
            </>
          ) : (
            <Button variant="aqua" onClick={onDone}>
              Done for today
            </Button>
          )}
        </>
      }
    />
  );
}

interface AllDoneProps {
  /** True when there are no cards at all yet. */
  emptyBox: boolean;
  top?: ReactNode;
  /** "Add a new word"; the button is hidden until adding words exists (roadmap 7.10). */
  onAddWord?: () => void;
}

/** Nothing (more) due today, or the daily cap is reached: calm aqua panel, sleeping mascot. */
export function AllDone({ emptyBox, top, onAddWord }: AllDoneProps) {
  const text = emptyBox
    ? 'Add your first word to start learning.'
    : onAddWord
      ? 'Your next words will be ready tomorrow. Want to add a new one?'
      : 'Your next words will be ready tomorrow.';
  return (
    <RestLayout
      pose="sleep"
      panel="aqua"
      top={top}
      title={emptyBox ? 'Your box is empty' : 'All done for today'}
      text={text}
      actions={
        onAddWord && (
          <Button variant="secondary" onClick={onAddWord} className={styles.withIcon}>
            <PlusIcon /> Add a new word
          </Button>
        )
      }
    />
  );
}

interface RestingProps {
  top?: ReactNode;
  onKeepGoing: () => void;
}

/** "I'm done for now" while more cards are still due (decided 2026-10-28). */
export function Resting({ top, onKeepGoing }: RestingProps) {
  return (
    <RestLayout
      pose="idle"
      panel="aqua"
      top={top}
      title="Nice work!"
      text="More words are waiting whenever you're ready."
      actions={
        <Button variant="secondary" onClick={onKeepGoing}>
          Keep going
        </Button>
      }
    />
  );
}
