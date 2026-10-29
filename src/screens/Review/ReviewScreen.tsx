import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { CardWithEntries } from '../../data/repository';
import { BottomPanel } from '../../ui/BottomPanel';
import { Button } from '../../ui/Button';
import { Card, CardStack } from '../../ui/Card';
import { Confetti } from '../../ui/Confetti';
import { FlipIcon } from '../../ui/icons';
import { Mascot, type MascotPose } from '../../ui/Mascot/Mascot';
import { Pill } from '../../ui/Pill';
import { CardBack } from './CardBack';
import styles from './ReviewScreen.module.css';
import { useSwipe } from './useSwipe';

interface ReviewScreenProps {
  card: CardWithEntries;
  /** "scheduled" = a real review; "practice" = a repeat of a missed card that changes nothing. */
  kind: 'scheduled' | 'practice';
  /** 0 … 1 through the scheduled part (shown as a bar, no numbers). */
  progress: number;
  /** Practice cards left, this one included. */
  practiceLeft: number;
  /** The mascot's short reaction to the previous answer. */
  reaction: 'happy' | 'cheer' | null;
  onAnswer: (correct: boolean) => void;
  /** Pencil on the card back; hidden until editing exists (roadmap 7.10). */
  onEdit?: () => void;
  top?: ReactNode;
}

/**
 * One card: the front shows the word (tap to flip, no swiping, PRD flow 4–5); the back shows
 * the answer, and you swipe right / left or use the buttons.
 */
export function ReviewScreen({
  card,
  kind,
  progress,
  practiceLeft,
  reaction,
  onAnswer,
  onEdit,
  top,
}: ReviewScreenProps) {
  const [flipped, setFlipped] = useState(false);
  const swipe = useSwipe(onAnswer, flipped);
  const backRef = useRef<HTMLDivElement>(null);
  const practice = kind === 'practice';

  // After the flip, move focus to the answer so a screen reader reads it.
  useEffect(() => {
    if (flipped) backRef.current?.focus();
  }, [flipped]);

  const direction =
    swipe.leaving ?? (swipe.pull > 0.5 ? 'right' : swipe.pull < -0.5 ? 'left' : null);
  const pose: MascotPose =
    direction === 'right' ? 'happy' : direction === 'left' ? 'cheer' : (reaction ?? 'idle');

  const cardStyle = {
    '--swipe-x': `${swipe.offset}px`,
    '--swipe-turn': `${swipe.offset / 18}deg`,
    '--stamp-right': Math.max(0, swipe.pull),
    '--stamp-left': Math.max(0, -swipe.pull),
  } as CSSProperties;

  const cardClasses = [
    styles.swipeable,
    swipe.dragging && styles.dragging,
    swipe.leaving === 'right' && styles.leaveRight,
    swipe.leaving === 'left' && styles.leaveLeft,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={styles.screen}>
      <Confetti amount="touch" />
      {top}
      {practice ? (
        <div className={styles.practiceBanner}>
          <span className={styles.practiceTitle}>
            <FlipIcon /> Practice round
          </span>
          <span className={styles.practiceLeft}>{practiceLeft} left</span>
        </div>
      ) : (
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${Math.max(progress, 0.06) * 100}%` }}
          />
        </div>
      )}

      <div className={styles.stage}>
        <CardStack className={flipped ? styles.stackBack : styles.stackFront}>
          {flipped ? (
            <div {...swipe.bind()} className={cardClasses} style={cardStyle}>
              <Card
                className={styles.back}
                ref={backRef}
                tabIndex={-1}
                aria-label={`Answer for ${card.card.word}`}
              >
                <CardBack card={card} onEdit={onEdit} />
              </Card>
              <span className={`${styles.stamp} ${styles.stampRight}`} aria-hidden="true">
                KNEW IT!
              </span>
              <span className={`${styles.stamp} ${styles.stampLeft}`} aria-hidden="true">
                NOT YET
              </span>
            </div>
          ) : (
            <Card className={styles.frontCard}>
              <button type="button" className={styles.front} onClick={() => setFlipped(true)}>
                <Pill variant="label" tone={practice ? 'aqua' : 'cream'}>
                  {practice ? 'one more look' : 'do you know it?'}
                </Pill>
                <span className={styles.word}>{card.card.word}</span>
                <span className={styles.hint}>
                  <FlipIcon /> tap to flip
                </span>
              </button>
            </Card>
          )}
        </CardStack>
      </div>

      <BottomPanel
        color={practice ? 'aqua' : 'orange'}
        className={styles.panel}
        mascot={<Mascot pose={pose} size="small" body={practice ? 'white' : 'aqua'} decorative />}
      >
        {!flipped ? (
          practice ? (
            <>
              <p className={styles.panelTitle}>Just for practice</p>
              <p className={styles.panelText}>
                The words you missed, one more time. Answers here don't change anything.
              </p>
            </>
          ) : (
            <>
              <p className={styles.panelTitle}>Think first…</p>
              <p className={styles.panelText}>then tap the card to see if you were right</p>
            </>
          )
        ) : (
          <>
            {!practice && direction === 'left' && (
              <p className={styles.reassure}>That's okay. You'll see it again tomorrow.</p>
            )}
            <div className={styles.answers}>
              <Button variant="secondary" onClick={() => swipe.flyOut('left')}>
                Not yet
              </Button>
              <Button onClick={() => swipe.flyOut('right')}>Knew it!</Button>
            </div>
          </>
        )}
      </BottomPanel>
    </main>
  );
}
