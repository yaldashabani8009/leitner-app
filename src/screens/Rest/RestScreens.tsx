import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { RestLayout } from './RestLayout';

interface SessionCompleteProps {
  /** Scheduled cards in the session that just ended (practice repeats not counted). */
  wordCount: number;
  /** Cards still due today and under the daily cap; 0 hides "Next … words" (canvas note 07). */
  nextCount: number;
  onNext: () => void;
  onDone: () => void;
}

/** Celebrating mascot. No score on purpose (decided 2026-10-28). */
export function SessionComplete({ wordCount, nextCount, onNext, onDone }: SessionCompleteProps) {
  const words = wordCount === 1 ? '1 word' : `${wordCount} words`;
  return (
    <RestLayout
      pose="celebrate"
      panel="orange"
      title="Session complete!"
      text={`You went through ${words}. Nice work.`}
      actions={
        <>
          {nextCount > 0 && (
            <Button onClick={onNext}>
              {nextCount === 1 ? 'Next word' : `Next ${nextCount} words`}
            </Button>
          )}
          <Button variant="text" onClick={onDone}>
            I'm done for now
          </Button>
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
    ? 'Your box is empty. Add your first word to start learning.'
    : onAddWord
      ? 'Your next words will be ready tomorrow. Want to add a new one?'
      : 'Your next words will be ready tomorrow.';
  return (
    <RestLayout
      pose="sleep"
      panel="aqua"
      top={top}
      title={emptyBox ? 'Nothing to review yet' : 'All done for today'}
      text={text}
      actions={onAddWord && <Button onClick={onAddWord}>Add a new word</Button>}
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
      actions={<Button onClick={onKeepGoing}>Keep going</Button>}
    />
  );
}
