import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { deckById } from '../../domain/decks/decks';
import {
  compareLetters,
  isCorrectSpelling,
  spokenComparison,
  type LetterStep,
} from '../../domain/spelling/check';
import { soundsAlike } from '../../domain/spelling/homophones';
import type { Speech } from '../../services/speech';
import { useSpeechState } from '../../services/useSpeech';
import { DeckChip } from '../../ui/DeckChip';
import styles from './SpellingScreen.module.css';

interface SpellingScreenProps {
  cardId: string;
  word: string;
  /** "practice" (the round at the end, extra practice): boxes never move; the tags say less. */
  kind: 'scheduled' | 'practice';
  /** 0 … 1 through the session. */
  progress: number;
  top?: ReactNode;
  speech: Speech | null;
  /** The first spelling card of a session: the big speaker says "Tap to start" (ADR-021). */
  needsStart: boolean;
  /** The Start tap played the word: sound is unlocked for the session. */
  onStarted: () => void;
  /** Save the answer (logged with what was typed; null for "Show me"). Doesn't move on. */
  onRecord: (correct: boolean, typed: string | null) => void;
  /**
   * Go on to the next card. Called inside the user's own tap or key press, so the next word can
   * be spoken right there (iPhone only allows sound from a touch).
   */
  onNext: (correct: boolean) => void;
  /** Laptop / screen reader: put the cursor in the field when the card appears. */
  autoFocus?: boolean;
}

type Phase =
  | { kind: 'typing' }
  /** typed: null = "Show me" (only "the word" is shown). */
  | { kind: 'wrong'; typed: string | null }
  | { kind: 'soundAlike'; typed: string };

/**
 * A spelling card (v3 brief 1.3, canvas P5–P7): listen and type.
 * The screen stays mounted from card to card, so the answer field (and the iPhone keyboard)
 * stays open; only its state resets when the card changes.
 */
export function SpellingScreen({
  cardId,
  word,
  kind,
  progress,
  top,
  speech,
  needsStart,
  onStarted,
  onRecord,
  onNext,
  autoFocus = true,
}: SpellingScreenProps) {
  const [shownCard, setShownCard] = useState(cardId);
  const [phase, setPhase] = useState<Phase>({ kind: 'typing' });
  const [answer, setAnswer] = useState('');
  const [shaking, setShaking] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const speechState = useSpeechState(speech);
  const practice = kind === 'practice';

  // A new card: back to typing, empty field (state reset during render, not in an effect).
  if (shownCard !== cardId) {
    setShownCard(cardId);
    setPhase({ kind: 'typing' });
    setAnswer('');
  }

  // Keep the cursor in the field, so the keyboard stays open and Return = Check.
  useEffect(() => {
    if (autoFocus) field.current?.focus({ preventScroll: true });
  }, [autoFocus, cardId, phase.kind]);

  function play(slow = false) {
    speech?.speak(word, { slow });
    if (needsStart) onStarted();
  }

  function check() {
    const typed = answer.trim();
    if (typed === '') return; // an empty answer does nothing
    if (isCorrectSpelling(typed, word)) {
      onRecord(true, typed);
      onNext(true);
      return;
    }
    // Words that sound the same: nothing is logged until one of the two ways on is chosen.
    if (soundsAlike(typed, word)) {
      setPhase({ kind: 'soundAlike', typed });
      setAnswer('');
      return;
    }
    onRecord(false, typed);
    setPhase({ kind: 'wrong', typed });
    setAnswer('');
  }

  function showMe() {
    onRecord(false, null);
    setPhase({ kind: 'wrong', typed: null });
    setAnswer('');
  }

  /** "Type it correctly once to go on": never moves the box again, never logged. */
  function retype() {
    if (!isCorrectSpelling(answer, word)) {
      setShaking(true);
      return;
    }
    if (phase.kind === 'soundAlike') onRecord(false, phase.typed); // typing it counts as wrong
    onNext(false);
  }

  function countIt() {
    if (phase.kind !== 'soundAlike') return;
    onRecord(true, phase.typed);
    onNext(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (phase.kind === 'typing') check();
    else retype();
  }

  const speakerLabel = needsStart
    ? 'Tap to start'
    : speechState === 'blocked'
      ? 'Tap to hear'
      : 'Play the word again';

  return (
    <main className={styles.screen}>
      {top}
      <div className={styles.progressRow}>
        <DeckChip deck={deckById('spelling')} variant="session" />
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className={styles.fill} style={{ width: `${Math.max(progress, 0.06) * 100}%` }} />
        </div>
      </div>

      {phase.kind === 'typing' ? (
        <section className={styles.card} aria-label="Listen and type">
          <span className={styles.tagAqua}>listen and type</span>
          <div className={styles.speakers}>
            <button
              type="button"
              className={`${styles.speaker} ${needsStart || speechState === 'blocked' ? styles.calling : ''}`}
              aria-label={speakerLabel}
              onClick={() => play()}
            >
              <SpeakerIcon size={50} />
            </button>
            <button
              type="button"
              className={styles.snail}
              aria-label="Play slowly"
              onClick={() => play(true)}
            >
              <SnailIcon />
            </button>
          </div>
          <span className={styles.hint}>
            {needsStart ? 'Tap to start' : speechState === 'blocked' ? 'Tap to hear' : 'tap to hear it again'}
          </span>
        </section>
      ) : phase.kind === 'wrong' ? (
        <section className={`${styles.card} ${styles.answerCard}`} aria-label="Not quite">
          <div className={styles.cardTop}>
            <span className={styles.tagCream}>
              {practice ? 'not quite' : 'not quite · back to the start'}
            </span>
            <ReplayButton onClick={() => play()} />
          </div>
          {phase.typed !== null ? (
            <Comparison typed={phase.typed} word={word} />
          ) : (
            <>
              <span className={styles.label}>the word</span>
              <span className={styles.big}>{word}</span>
            </>
          )}
        </section>
      ) : (
        <section className={`${styles.card} ${styles.answerCard}`} aria-label="Sounds the same">
          <div className={styles.cardTop}>
            <span className={styles.tagAqua}>sounds the same</span>
            <ReplayButton onClick={() => play()} />
          </div>
          <div className={styles.pair}>
            <div className={styles.half}>
              <span className={styles.label}>you typed</span>
              <span className={`${styles.big} ${styles.muted}`}>{phase.typed}</span>
            </div>
            <div className={styles.half}>
              <span className={styles.label}>the word</span>
              <span className={styles.big}>{word}</span>
            </div>
          </div>
          <p className={styles.note}>
            Both are real words that sound alike, so you can't tell from the sound alone.
          </p>
        </section>
      )}

      {phase.kind === 'soundAlike' && (
        <button type="button" className={styles.countIt} onClick={countIt}>
          Sounds the same, count it
        </button>
      )}

      <form className={styles.answerRow} onSubmit={submit}>
        <input
          ref={field}
          className={`${styles.field} ${shaking ? styles.shake : ''} ${phase.kind === 'soundAlike' ? styles.fieldQuiet : ''}`}
          onAnimationEnd={() => setShaking(false)}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          aria-label={
            phase.kind === 'typing'
              ? 'Type what you hear'
              : phase.kind === 'soundAlike'
                ? `Or type ${word} once to go on`
                : 'Type it once to go on'
          }
          placeholder={
            phase.kind === 'typing'
              ? 'Type what you hear'
              : phase.kind === 'soundAlike'
                ? 'Or type it once to go on'
                : 'Type it once to go on'
          }
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button type="submit" className={styles.go}>
          {phase.kind === 'typing' ? 'Check' : 'Next'}
        </button>
      </form>
      {phase.kind === 'typing' && (
        <div className={styles.showMeRow}>
          <button type="button" className={styles.showMe} onClick={showMe}>
            Show me
          </button>
        </div>
      )}
    </main>
  );
}

/** "you typed" over "the word", letter by letter (canvas P6). */
function Comparison({ typed, word }: { typed: string; word: string }) {
  const steps = compareLetters(typed, word);
  return (
    <>
      <p className={styles.srOnly}>{spokenComparison(typed, word)}</p>
      <div aria-hidden="true" className={styles.comparison}>
        <span className={styles.label}>you typed</span>
        <span className={`${styles.letters} ${styles.muted}`}>
          {steps.map((step, i) => (
            <TypedLetter key={i} step={step} />
          ))}
        </span>
        <span className={styles.label}>the word</span>
        <span className={styles.letters}>
          {steps.map((step, i) => (
            <WordLetter key={i} step={step} />
          ))}
        </span>
        <span className={styles.legend}>crossed out = extra letter · aqua = missing letter</span>
      </div>
    </>
  );
}

function TypedLetter({ step }: { step: LetterStep }) {
  if (step.kind === 'same') return <>{step.typed}</>;
  if (step.kind === 'extra') return <span className={styles.extra}>{step.typed}</span>;
  if (step.kind === 'missing') return <span className={styles.gap} />;
  return <span className={styles.wrongTyped}>{step.typed}</span>;
}

function WordLetter({ step }: { step: LetterStep }) {
  if (step.kind === 'same') return <>{step.word}</>;
  if (step.kind === 'extra') return null;
  return <span className={styles.missing}>{step.word}</span>;
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.replay} aria-label="Play the word again" onClick={onClick}>
      <SpeakerIcon size={22} filled />
    </button>
  );
}

function SpeakerIcon({ size, filled = false }: { size: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.speakerIcon}>
      <path
        className={filled ? styles.speakerBodyAqua : styles.speakerBody}
        d="M4 9h3l5-4v14l-5-4H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"
      />
      <path className={styles.waves} d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

/** The snail drawn on canvas P5 (the slow replay). */
function SnailIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" className={styles.snailIcon}>
      <path d="M2.5 18.5h14.5a3.5 3.5 0 0 0 3.5-3.5v-4" />
      <path d="M20.5 11 19.3 7.4M20.5 11l2-3" />
      <circle className={styles.dot} cx="19.2" cy="7" r=".9" />
      <circle className={styles.dot} cx="22.7" cy="7.6" r=".9" />
      <circle className={styles.shell} cx="10" cy="12.3" r="5.8" />
      <path d="M10 12.3a1.7 1.7 0 1 1 1.7-1.7 3.4 3.4 0 1 1-3.4 3.4" />
    </svg>
  );
}
