import { Confetti } from '../../ui/Confetti';
import { Mascot } from '../../ui/Mascot/Mascot';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  /** Profile display name; without one the title is just "Leitner." (PRD user flow 2). */
  name?: string | null;
}

/** About a second on a cold start: confetti, the waving mascot and "Yali's Leitner." */
export function LoadingScreen({ name }: LoadingScreenProps) {
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
    </main>
  );
}
