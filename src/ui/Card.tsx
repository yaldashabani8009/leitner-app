import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * The white word card: 40px corners, chunky ink outline, 6px hard shadow.
 * It is a plain box; put a full-size button inside it when the whole card is tappable (flip).
 */
export function Card({ className, ...rest }: CardProps) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest} />;
}

interface CardStackProps {
  className?: string;
  /** The current card, usually a <Card>. */
  children: ReactNode;
}

/** Tilted aqua + peach cards peeking out behind the current card (docs/design). */
export function CardStack({ className, children }: CardStackProps) {
  return (
    <div className={[styles.stack, className].filter(Boolean).join(' ')}>
      <div className={`${styles.behind} ${styles.behindAqua}`} aria-hidden="true" />
      <div className={`${styles.behind} ${styles.behindCream}`} aria-hidden="true" />
      <div className={styles.front}>{children}</div>
    </div>
  );
}
