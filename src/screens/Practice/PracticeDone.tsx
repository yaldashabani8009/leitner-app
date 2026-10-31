import { useEffect, useRef } from 'react';
import { Button } from '../../ui/Button';
import { RetryIcon } from '../../ui/icons';
import { Mascot } from '../../ui/Mascot/Mascot';
import styles from './PracticeDone.module.css';

interface PracticeDoneProps {
  /** Cards missed in the round that just ended. */
  missed: number;
  /** Go again with just the missed ones (shuffled again). */
  onAgain: () => void;
  onDone: () => void;
}

/**
 * The end of a round of extra practice (v3 brief 1.7, canvas N12). Calm: no confetti.
 * "You missed 4. Want one more go at just those?" repeats with the smaller list until nothing
 * is missed or Done is tapped.
 */
export function PracticeDone({ missed, onAgain, onDone }: PracticeDoneProps) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), []);
  return (
    <main className={styles.screen}>
      <div className={styles.circle}>
        <Mascot pose="idle" decorative />
      </div>
      <div className={styles.bottom}>
        <h1 ref={title} tabIndex={-1} className={styles.title}>
          Practice done!
        </h1>
        <p className={styles.text}>
          {missed === 0
            ? 'You knew every one.'
            : `You missed ${missed}. Want one more go at just ${missed === 1 ? 'that one' : 'those'}?`}
        </p>
        <div className={styles.grow} />
        {missed > 0 ? (
          <>
            <Button variant="aqua" onClick={onAgain} className={styles.again}>
              <RetryIcon size={20} />
              {missed === 1 ? 'Practice it again' : `Practice the ${missed} again`}
            </Button>
            <Button variant="text" onClick={onDone} className={styles.done}>
              Done
            </Button>
          </>
        ) : (
          <Button variant="aqua" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    </main>
  );
}
