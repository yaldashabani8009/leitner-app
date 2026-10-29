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
  /**
   * "panel": title and text sit in the tall colour panel (all done).
   * "stage": title and text sit under the mascot; the panel holds only the buttons
   * (session complete, Yali 2026-10-29: so nothing else in the panel looks like a button).
   */
  textIn?: 'panel' | 'stage';
  /** A speech bubble from the mascot, e.g. the streak on Session complete. */
  bubble?: ReactNode;
}

/**
 * Shared layout of Session complete and All done (docs/design): confetti, a big mascot in a
 * cream circle, and the tall colour panel with the title, a line of text and the buttons.
 */
export function RestLayout({
  pose,
  panel,
  title,
  text,
  top,
  actions,
  textIn = 'panel',
  bubble,
}: RestLayoutProps) {
  const words = (
    <>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{text}</p>
    </>
  );
  return (
    <main className={styles.screen}>
      <Confetti />
      {top}
      <div className={styles.stage}>
        <div className={styles.mascotCircle}>
          {bubble && <p className={styles.bubble}>{bubble}</p>}
          <Mascot pose={pose} decorative />
        </div>
        {textIn === 'stage' && <div className={styles.stageWords}>{words}</div>}
      </div>
      {textIn === 'stage' ? (
        <BottomPanel color={panel} className={styles.panel}>
          {actions && <div className={styles.actions}>{actions}</div>}
        </BottomPanel>
      ) : (
        <BottomPanel color={panel} size="tall" className={styles.panel}>
          {words}
          {actions && <div className={styles.actions}>{actions}</div>}
        </BottomPanel>
      )}
    </main>
  );
}
