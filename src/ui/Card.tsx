import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = ComponentPropsWithRef<'div'>;

/**
 * The white word card: 40px corners, chunky ink outline, 6px hard shadow.
 * It is a plain box; put a full-size button inside it when the whole card is tappable (flip).
 */
export function Card({ className, ...rest }: CardProps) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest} />;
}

interface CardStackProps {
  className?: string;
  /** "phrases" (canvas P8): a white and a pale terracotta card behind, instead of aqua + peach. */
  tone?: 'default' | 'phrases';
  /** The current card, usually a <Card>. */
  children: ReactNode;
}

/** Tilted aqua + peach cards peeking out behind the current card (docs/design). */
export function CardStack({ className, tone = 'default', children }: CardStackProps) {
  const phrases = tone === 'phrases';
  return (
    <div className={[styles.stack, className].filter(Boolean).join(' ')}>
      <div
        className={`${styles.behind} ${styles.behindAqua} ${phrases ? styles.behindWhite : ''}`}
        aria-hidden="true"
      />
      <div
        className={`${styles.behind} ${styles.behindCream} ${phrases ? styles.behindTerracotta : ''}`}
        aria-hidden="true"
      />
      <div className={styles.front}>{children}</div>
    </div>
  );
}
