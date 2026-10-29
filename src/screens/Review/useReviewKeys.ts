import { useEffect } from 'react';

interface ReviewKeys {
  /** Space: flip the card (front only). */
  onFlip?: () => void;
  /** ← Not yet, → Knew it! (back only). */
  onAnswer?: (correct: boolean) => void;
  /** E: edit the card (back only). */
  onEdit?: () => void;
}

/**
 * Laptop shortcuts (PRD "User flow", roadmap 7.13). Esc is handled by the sheets themselves.
 * Ignored while a sheet or dialog is open, while typing, and with Ctrl / ⌘ / Alt held, so
 * browser shortcuts keep working. Space on a focused button keeps its normal meaning (press it).
 * (An effect is right here: it listens to the keyboard; it doesn't fetch data.)
 */
export function useReviewKeys({ onFlip, onAnswer, onEdit }: ReviewKeys): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      let action: (() => void) | undefined;
      if (event.key === ' ' && !target?.closest('button, a[href]')) action = onFlip;
      else if (event.key === 'ArrowLeft' && onAnswer) action = () => onAnswer(false);
      else if (event.key === 'ArrowRight' && onAnswer) action = () => onAnswer(true);
      else if (event.key === 'e' || event.key === 'E') action = onEdit;
      if (!action || event.repeat) return;

      event.preventDefault(); // no page scroll on Space, no "e" typed into the edit sheet
      action();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFlip, onAnswer, onEdit]);
}
