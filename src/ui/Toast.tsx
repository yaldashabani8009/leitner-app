import type { ReactNode } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  /** The message; null shows nothing (the live region stays, so the next message is read out). */
  children: ReactNode | null;
  /** Changes with each new message, so the same text shown twice still pops in again. */
  messageId?: number;
}

/**
 * A short message near the top of the screen with an aqua check (canvas N4: "meticulous saved").
 * `role="status"` makes screen readers read it without moving focus. The parent decides how long
 * it shows (about 2 s after a save).
 */
export function Toast({ children, messageId }: ToastProps) {
  return (
    <div role="status" className={styles.region}>
      {children !== null && (
        <div key={messageId} className={styles.toast}>
          <span className={styles.check} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span>{children}</span>
        </div>
      )}
    </div>
  );
}
