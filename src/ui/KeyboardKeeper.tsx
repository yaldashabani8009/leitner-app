import type { Ref } from 'react';
import styles from './KeyboardKeeper.module.css';

/**
 * An invisible text field. iPhone only opens the keyboard when a field is focused inside the
 * user's own touch, but in Mix them all the spelling card appears after the previous card has
 * flown off. So the swipe focuses this field at once (keyboard opens), and the spelling card
 * then moves focus to its own answer field, which keeps the keyboard open (v3 brief 1.4).
 */
export function KeyboardKeeper({ ref }: { ref: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className={styles.keeper}
      aria-hidden="true"
      tabIndex={-1}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
}
