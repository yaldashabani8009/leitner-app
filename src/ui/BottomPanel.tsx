import type { ReactNode } from 'react';
import styles from './BottomPanel.module.css';

interface BottomPanelProps {
  /** Orange: review, session complete. Aqua: practice, all done (docs/design). */
  color: 'orange' | 'aqua';
  /** "compact": review / practice (~124–160px). "tall": session complete / all done (330px). */
  size?: 'compact' | 'tall';
  /** Optional mascot that peeks over the top-left edge of the panel. */
  mascot?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Big rounded colour panel at the bottom of the screen that holds the actions. */
export function BottomPanel({
  color,
  size = 'compact',
  mascot,
  className,
  children,
}: BottomPanelProps) {
  const classes = [styles.panel, styles[color], styles[size], className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {mascot && <div className={styles.mascot}>{mascot}</div>}
      {children}
    </div>
  );
}
