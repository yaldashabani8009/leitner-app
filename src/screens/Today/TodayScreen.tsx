import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import type { DeckStatus } from '../../data/repository';
import type { Deck } from '../../domain/decks/decks';
import { DeckIcon } from '../../ui/DeckIcon';
import { DjMascot } from '../../ui/Mascot/DjMascot';
import { deckState, statusLine } from './deckState';
import { DoneDeckSheet } from './DoneDeckSheet';
import styles from './TodayScreen.module.css';

interface TodayScreenProps {
  /** The profile's display name; none → "Hi!". */
  name: string | null;
  /** The enabled decks, in registry order. */
  decks: readonly Deck[];
  /** Each deck's state, in the same order. */
  statuses: readonly DeckStatus[];
  /** Cards left in a "Mix them all" left half way today; null when there is none. */
  mixPausedLeft?: number | null;
  top: ReactNode;
  /** "Mix them all". */
  onMix: () => void;
  /** Start or continue a deck's session. */
  onStudy: (deck: Deck) => void;
  /** Open a deck's add sheet. */
  onAdd: (deck: Deck) => void;
  /** Extra practice of today's new words of a deck (from a finished deck, N3). */
  onPractice?: (deck: Deck) => void;
}

/** Drag this far up or down to turn the wheel by one deck. */
const SPIN_STEP_PX = 60;
/** The three places a deck card can hang (canvas N1): top −9°, middle 0°, bottom +9°. */
const SLOTS = ['top', 'middle', 'bottom'] as const;

/**
 * The Today screen (v3 brief 1.4, canvas N1): the new home after Loading. A greeting, the DJ
 * mascot with "Mix them all", and one card per enabled deck hanging from a wheel on the left.
 * Drag up or down to spin the wheel (it matters once there are more than three decks).
 * Calm: cream page, white cards, no confetti; the DJ is the only playful element.
 */
export function TodayScreen({
  name,
  decks,
  statuses,
  mixPausedLeft = null,
  top,
  onMix,
  onStudy,
  onAdd,
  onPractice = () => {},
}: TodayScreenProps) {
  const [offset, setOffset] = useState(0);
  const [doneDeck, setDoneDeck] = useState<Deck | null>(null);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const waiting = statuses.reduce((sum, status) => sum + status.waiting, 0);

  const count = decks.length;
  const shown = Math.min(count, SLOTS.length);
  // One deck hangs in the middle; two take the top and middle; three or more fill all three.
  const firstSlot = shown === 1 ? 1 : 0;
  const visible = Array.from({ length: shown }, (_, i) => (offset + i) % count);

  function onPointerDown(event: PointerEvent) {
    drag.current = { y: event.clientY, moved: false };
  }
  function onPointerMove(event: PointerEvent) {
    const start = drag.current;
    if (!start || count < 2) return;
    const delta = event.clientY - start.y;
    if (Math.abs(delta) < SPIN_STEP_PX) return;
    // Dragging up brings the next deck up into view.
    setOffset((current) => (current + (delta < 0 ? 1 : count - 1)) % count);
    drag.current = { y: event.clientY, moved: true };
  }
  function onPointerUp() {
    // Let the click that ends a spin through only when nothing moved.
    window.setTimeout(() => (drag.current = null), 0);
  }

  function open(deck: Deck, status: DeckStatus) {
    if (drag.current?.moved) return;
    const state = deckState(status);
    if (state === 'paused' || state === 'due') onStudy(deck);
    else if (state === 'empty') onAdd(deck);
    else setDoneDeck(deck);
  }

  return (
    <main className={styles.screen}>
      {top}
      <div className={styles.greeting}>
        <h1 className={styles.hi}>{name ? `Hi ${name}!` : 'Hi!'}</h1>
        <p className={styles.ask}>What shall we study today?</p>
      </div>

      <div className={styles.dj}>
        <DjMascot />
        <div className={styles.mix}>
          <button type="button" className={styles.mixButton} onClick={onMix}>
            Mix them all
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
          <span className={styles.mixCount}>
            {mixPausedLeft !== null
              ? `Paused · ${mixPausedLeft} left`
              : waiting === 0
                ? 'All done for today'
                : `${waiting} ${waiting === 1 ? 'card' : 'cards'} from all decks`}
          </span>
        </div>
      </div>

      <div
        className={styles.wheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className={styles.arc} width="60" height="540" viewBox="0 0 60 540" aria-hidden="true">
          <circle className={styles.arcOuter} cx="-552" cy="252" r="588" />
          <circle className={styles.arcInner} cx="-552" cy="252" r="588" />
        </svg>
        <ul className={styles.decks} aria-label="Your decks">
          {visible.map((deckIndex, i) => {
            const deck = decks[deckIndex];
            const status = statuses[deckIndex];
            const state = deckState(status);
            const line = statusLine(status);
            const action =
              state === 'paused'
                ? '. Continue'
                : state === 'due'
                  ? '. Start'
                  : state === 'empty'
                    ? '. Add words'
                    : '';
            return (
              <li
                key={deck.id}
                className={`${styles.hanger} ${styles[SLOTS[firstSlot + i]]}`}
                style={
                  {
                    '--edge': `var(${deck.edgeColor})`,
                    '--tile': `var(${deck.tileColor})`,
                  } as CSSProperties
                }
              >
                <svg
                  className={styles.pin}
                  width="40"
                  height="20"
                  viewBox="0 0 40 20"
                  aria-hidden="true"
                >
                  <circle className={styles.pinHead} cx="7" cy="10" r="5.5" />
                  <path className={styles.pinLink} d="M12.5 10 H30" />
                  <circle className={styles.pinRing} cx="33" cy="10" r="4" />
                </svg>
                <button
                  type="button"
                  className={styles.deck}
                  aria-label={`${deck.label}, ${line.toLowerCase()}${action}`}
                  onClick={() => open(deck, status)}
                >
                  <span className={styles.face}>
                    <span className={styles.tile}>
                      <DeckIcon icon={deck.icon} size={deck.icon === 'sparkles' ? 20 : 22} />
                    </span>
                    <span className={styles.text}>
                      <span className={styles.name}>{deck.label}</span>
                      <span className={styles.status}>{line}</span>
                    </span>
                    {(state === 'paused' || state === 'due') && (
                      <span className={styles.play}>
                        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 4.5v15l13-7.5z" />
                        </svg>
                      </span>
                    )}
                    {state === 'done' && (
                      <span className={styles.check}>
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <DoneDeckSheet
        deck={doneDeck}
        onClose={() => setDoneDeck(null)}
        onAdd={(deck) => {
          setDoneDeck(null);
          onAdd(deck);
        }}
        addedToday={
          doneDeck ? (statuses[decks.findIndex((d) => d.id === doneDeck.id)]?.addedToday ?? 0) : 0
        }
        onPractice={(deck) => {
          setDoneDeck(null);
          onPractice(deck);
        }}
      />
    </main>
  );
}
