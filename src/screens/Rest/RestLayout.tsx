import type { ReactNode } from 'react';
import { BottomPanel } from '../../ui/BottomPanel';
import { Confetti } from '../../ui/Confetti';
import { Mascot, type MascotPose } from '../../ui/Mascot/Mascot';
import styles from './RestLayout.module.css';

interface RestLayoutProps {
  pose: MascotPose;
  panel: 'orange' | 'aqua';
  title: string;
  text: string;
  /** Usually the top bar (all done) or nothing (session complete). */
  top?: ReactNode;
  /** Buttons at the bottom of the panel. */
  actions?: ReactNode;
}

/**
 * Shared layout of Session complete and All done (docs/design): confetti, a big mascot in a
 * cream circle, and the tall colour panel with the title, a line of text and the buttons.
 */
export function RestLayout({ pose, panel, title, text, top, actions }: RestLayoutProps) {
  return (
    <main className={styles.screen}>
      <Confetti />
      {top}
      <div className={styles.stage}>
        <div className={styles.mascotCircle}>
          <Mascot pose={pose} decorative />
        </div>
      </div>
      <BottomPanel color={panel} size="tall" className={styles.panel}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        {actions && <div className={styles.actions}>{actions}</div>}
      </BottomPanel>
    </main>
  );
}
