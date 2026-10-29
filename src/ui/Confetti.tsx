import styles from './Confetti.module.css';

interface ConfettiProps {
  /**
   * "full": loading, all done. "touch": a little on the review screen (docs/design).
   * "celebrate": session complete, placed as on canvas 07.
   */
  amount?: 'full' | 'touch' | 'celebrate';
}

const SPARKLE = 'M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z';
const TRIANGLE = 'M12 3L22 20H2Z';

/** Memphis confetti: sparkles, a triangle and dots, behind the screen content. */
export function Confetti({ amount = 'full' }: ConfettiProps) {
  if (amount === 'celebrate') {
    return (
      <div className={styles.confetti} aria-hidden="true">
        <svg className={`${styles.c07} ${styles.c07Sparkle}`} viewBox="0 0 24 24">
          <path d={SPARKLE} />
        </svg>
        <svg className={`${styles.c07} ${styles.c07Triangle}`} viewBox="0 0 24 24">
          <path d={TRIANGLE} />
        </svg>
        <svg className={`${styles.c07} ${styles.c07Orange}`} viewBox="0 0 24 24">
          <path d={SPARKLE} />
        </svg>
        <svg className={`${styles.c07} ${styles.c07CreamTriangle}`} viewBox="0 0 24 24">
          <path d={TRIANGLE} transform="rotate(20 12 12)" />
        </svg>
        <span className={`${styles.c07} ${styles.dot} ${styles.c07Terracotta}`} />
        <span className={`${styles.c07} ${styles.dot} ${styles.c07White}`} />
        <span className={`${styles.c07} ${styles.dot} ${styles.c07Ink}`} />
      </div>
    );
  }
  return (
    <div
      className={[styles.confetti, amount === 'full' && styles.lively].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg className={`${styles.sparkle} ${styles.sparkleInk}`} viewBox="0 0 24 24">
        <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
      </svg>
      <span className={`${styles.dot} ${styles.dotTerracotta}`} />
      {amount === 'full' && (
        <>
          <svg className={styles.triangle} viewBox="0 0 24 24">
            <path d="M12 3L22 20H2Z" />
          </svg>
          <svg className={`${styles.sparkle} ${styles.sparkleOrange}`} viewBox="0 0 24 24">
            <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
          </svg>
          <span className={`${styles.dot} ${styles.dotInk}`} />
          <span className={`${styles.dot} ${styles.dotCream}`} />
        </>
      )}
    </div>
  );
}
