import { Confetti } from '../../ui/Confetti';
import { FlameIcon } from '../../ui/icons';
import { Mascot } from '../../ui/Mascot/Mascot';
import { Pill } from '../../ui/Pill';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  /** Profile display name; without one the title is just "Leitner." (PRD user flow 2). */
  name?: string | null;
  /** Days in a row (canvas 01). Hidden while unknown or 0, so a new box starts calm. */
  streak?: number;
}

/** 2.5 s on a cold start: confetti, the waving mascot, "Yali's Leitner." and the streak pill. */
export function LoadingScreen({ name, streak }: LoadingScreenProps) {
  return (
    <main className={styles.screen} aria-busy="true">
      <Confetti />
      <div className={styles.mascotCircle}>
        <Mascot pose="wave" decorative />
      </div>
      <h1 className={styles.title}>
        {name ? `${name}'s Leitner` : 'Leitner'}
        <span className={styles.dot}>.</span>
      </h1>
      {streak !== undefined && streak > 0 && (
        <Pill variant="stat" icon={<FlameIcon />} className={styles.streak}>
          {streak === 1 ? '1 day in a row' : `${streak} days in a row`}
        </Pill>
      )}
    </main>
  );
}
