import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Deck } from '../../domain/decks/decks';
import { DeckChip } from '../../ui/DeckChip';
import type { CardWithEntries } from '../../data/repository';
import { BottomPanel } from '../../ui/BottomPanel';
import { Button } from '../../ui/Button';
import { Card, CardStack } from '../../ui/Card';
import { Confetti } from '../../ui/Confetti';
import { FlipIcon, RetryIcon } from '../../ui/icons';
import { Mascot, type MascotPose } from '../../ui/Mascot/Mascot';
import { Pill } from '../../ui/Pill';
import { CardBack } from './CardBack';
import styles from './ReviewScreen.module.css';
import { useReviewKeys } from './useReviewKeys';
import { useSwipe } from './useSwipe';

interface ReviewScreenProps {
  card: CardWithEntries;
  /** "scheduled" = a real review; "practice" = a repeat of a missed card that changes nothing. */
  kind: 'scheduled' | 'practice';
  /** 0 … 1 through the scheduled part (shown as a bar, no numbers). */
  progress: number;
  /** In Mix them all: the deck of this card, shown as a chip next to the progress bar (N6). */
  deck?: Deck;
  /**
   * Extra practice (v3 brief 1.7, canvas N11): the calm look. A white banner "Practice · your
   * boxes stay the same" with the cards left, the tag "today's new words", one quiet line under
   * the card and no coloured panel. Answers are logged as practice and never move the card.
   */
  extra?: { left: number };
  /** Practice cards left, this one included. */
  practiceLeft: number;
  /** The mascot's short reaction to the previous answer. */
  reaction: 'happy' | 'cheer' | null;
  onAnswer: (correct: boolean) => void;
  /** Pencil on the card back; hidden until editing exists (roadmap 7.10). */
  onEdit?: () => void;
  top?: ReactNode;
  /**
   * Put focus on the card front when it appears: set after an answer given with the keyboard
   * or a screen reader, so they don't lose their place (audit 2026-10-29, WCAG 2.4.3).
   */
  focusOnStart?: boolean;
}

/**
 * One card: the front shows the word (tap to flip, no swiping, PRD flow 4–5); the back shows
 * the answer, and you swipe right / left or use the buttons.
 */
export function ReviewScreen({
  card,
  kind,
  progress,
  deck,
  extra,
  practiceLeft,
  reaction,
  onAnswer,
  onEdit,
  top,
  focusOnStart = false,
}: ReviewScreenProps) {
  const [flipped, setFlipped] = useState(false);
  const swipe = useSwipe(onAnswer, flipped);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLButtonElement>(null);
  const practice = kind === 'practice';

  useReviewKeys(
    flipped
      ? { onAnswer: (correct) => swipe.flyOut(correct ? 'right' : 'left'), onEdit }
      : { onFlip: () => setFlipped(true) },
  );

  // Runs once: this screen is mounted fresh for every card (StudyFlow gives it a new key).
  useEffect(() => {
    if (focusOnStart) frontRef.current?.focus({ preventScroll: true });
  }, [focusOnStart]);

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
    // Answered with a button or key (not dragged): a small pull-back first (anticipation).
    swipe.leaving && swipe.offset === 0 && styles.flick,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={styles.screen}>
      {!extra && <Confetti amount="touch" />}
      {top}
      {extra ? (
        <div className={styles.extraBanner}>
          <span className={styles.extraTitle}>
            <RetryIcon /> Practice · your boxes stay the same
          </span>
          <span className={styles.extraLeft}>{extra.left} left</span>
        </div>
      ) : practice ? (
        <div className={styles.practiceBanner}>
          <span className={styles.practiceTitle}>
            <FlipIcon /> Practice round
          </span>
          <span className={styles.practiceLeft}>{practiceLeft} left</span>
        </div>
      ) : (
        <div className={deck ? styles.progressRow : styles.progressAlone}>
          {deck && <DeckChip deck={deck} variant="session" />}
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
              <button
                ref={frontRef}
                type="button"
                className={styles.front}
                onClick={() => setFlipped(true)}
                aria-keyshortcuts="Space"
              >
                <Pill variant="label" tone={extra ? 'aquaPale' : practice ? 'aqua' : 'cream'}>
                  {extra ? "today's new words" : practice ? 'one more look' : 'do you know it?'}
                </Pill>
                <span className={styles.word}>{card.card.word}</span>
                <span className={styles.hint}>
                  <FlipIcon /> <span className={styles.touchOnly}>tap to flip</span>
                  <span className={styles.pointerOnly}>click or press space</span>
                </span>
              </button>
            </Card>
          )}
        </CardStack>
      </div>

      {extra ? (
        <div className={styles.calmFooter}>
          {flipped && (
            <div className={styles.answers}>
              <Button
                variant="secondary"
                onClick={() => swipe.flyOut('left')}
                aria-keyshortcuts="ArrowLeft"
              >
                Not yet
              </Button>
              <Button
                variant="aqua"
                onClick={() => swipe.flyOut('right')}
                aria-keyshortcuts="ArrowRight"
              >
                Knew it!
              </Button>
            </div>
          )}
          <p className={styles.quiet}>Just for fun: answers here never move your cards</p>
        </div>
      ) : (
        <BottomPanel
          color={practice ? 'aqua' : 'orange'}
          className={[styles.panel, flipped && !practice && styles.answerPanel]
            .filter(Boolean)
            .join(' ')}
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
                <p className={styles.panelText}>
                  <span className={styles.touchOnly}>
                    then tap the card to see if you were right
                  </span>
                  <span className={styles.pointerOnly}>
                    then flip the card to see if you were right
                  </span>
                </p>
              </>
            )
          ) : (
            <>
              {!practice && direction === 'left' && (
                <p className={styles.reassure}>That's okay. You'll see it again tomorrow.</p>
              )}
              <div className={styles.answers}>
                <Button
                  variant="secondary"
                  onClick={() => swipe.flyOut('left')}
                  aria-keyshortcuts="ArrowLeft"
                >
                  Not yet
                </Button>
                {/* Aqua on the white review panel; orange on the aqua practice panel. */}
                <Button
                  variant={practice ? 'primary' : 'aqua'}
                  onClick={() => swipe.flyOut('right')}
                  aria-keyshortcuts="ArrowRight"
                >
                  Knew it!
                </Button>
              </div>
            </>
          )}
        </BottomPanel>
      )}
    </main>
  );
}
