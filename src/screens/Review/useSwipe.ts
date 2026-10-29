import { useDrag } from '@use-gesture/react';
import { useRef, useState } from 'react';
import { useReducedMotion } from '../../ui/useReducedMotion';

/** Release past this share of the card width to answer (canvas note 04: "~30%"). */
export const SWIPE_SHARE = 0.3;
/** Never less than this many px, so a small wobble is not an answer. */
export const MIN_SWIPE_PX = 60;
/** How long the card takes to fly off before the next one shows. */
export const FLY_OUT_MS = 220;

export type SwipeDirection = 'right' | 'left';

/**
 * Swipe a card: right = knew it, left = not yet (ADR-014).
 * Returns the card's horizontal offset while dragging, and `flyOut` for the buttons.
 */
export function useSwipe(onAnswer: (correct: boolean) => void, enabled: boolean) {
  const reducedMotion = useReducedMotion();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null);
  const done = useRef(false);

  function flyOut(direction: SwipeDirection) {
    if (done.current) return;
    done.current = true;
    const answerNow = () => onAnswer(direction === 'right');
    if (reducedMotion) {
      answerNow();
      return;
    }
    setLeaving(direction);
    setTimeout(answerNow, FLY_OUT_MS);
  }

  const bind = useDrag(
    ({ active, movement: [mx], target }) => {
      if (done.current) return;
      if (active) {
        setDragging(true);
        setOffset(mx);
        return;
      }
      setDragging(false);
      const width = (target as HTMLElement).getBoundingClientRect().width;
      const threshold = Math.max(width * SWIPE_SHARE, MIN_SWIPE_PX);
      if (Math.abs(mx) >= threshold) {
        flyOut(mx > 0 ? 'right' : 'left');
      } else {
        setOffset(0); // springs back (CSS transition)
      }
    },
    { enabled, axis: 'x', filterTaps: true },
  );

  /** -1 … 1: how far towards an answer the card is, for the stamps and the mascot. */
  const pull = Math.max(-1, Math.min(1, offset / (MIN_SWIPE_PX * 2)));
  return { bind, offset, dragging, leaving, pull, flyOut };
}
