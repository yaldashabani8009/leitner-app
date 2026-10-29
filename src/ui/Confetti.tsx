import styles from './Confetti.module.css';

interface ConfettiProps {
  /** "full": loading, session complete, all done. "touch": a little on the review screen (docs/design). */
  amount?: 'full' | 'touch';
}

/** Memphis confetti: sparkles, a triangle and dots, behind the screen content. */
export function Confetti({ amount = 'full' }: ConfettiProps) {
  return (
    <div className={styles.confetti} aria-hidden="true">
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
