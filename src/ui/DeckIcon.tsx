import type { DeckIcon as DeckIconName } from '../domain/decks/decks';
import styles from './DeckIcon.module.css';

interface DeckIconProps {
  icon: DeckIconName;
  /** 22 in deck tiles and roll-out buttons, 18 on chips, 16 in the add sheet's deck chip. */
  size?: number;
  /** 2 in tiles and rows, 2.2 on chips (canvas N1, N4, N8). */
  strokeWidth?: number;
  className?: string;
}

/**
 * The deck icons drawn on the canvas (N1, N2, N8): an orange book (vocab), an aqua speaker
 * (spelling) and terracotta sparkles (phrases). Decorative: the button around them names the deck.
 */
export function DeckIcon({ icon, size = 22, strokeWidth = 2, className }: DeckIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      strokeWidth={strokeWidth}
      className={[styles.icon, styles[icon], className].filter(Boolean).join(' ')}
    >
      {icon === 'book' && (
        <>
          <path d="M3 5.5C3 4.7 3.7 4 4.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4.5C3.7 18 3 17.3 3 16.5z" />
          <path d="M21 5.5c0-.8-.7-1.5-1.5-1.5H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5.5c.8 0 1.5-.7 1.5-1.5z" />
        </>
      )}
      {icon === 'speaker' && (
        <>
          <path d="M4 9h3l5-4v14l-5-4H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z" />
          <path className={styles.line} d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
        </>
      )}
      {icon === 'sparkles' && (
        <>
          <path d="M11 2.5c.8 4.6 2.9 6.7 7.5 7.5-4.6.8-6.7 2.9-7.5 7.5-.8-4.6-2.9-6.7-7.5-7.5 4.6-.8 6.7-2.9 7.5-7.5z" />
          <path d="M19 14.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z" />
        </>
      )}
    </svg>
  );
}
