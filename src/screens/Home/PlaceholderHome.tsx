import { useLiveQuery } from 'dexie-react-hooks';
import type { Repository } from '../../data/repository';
import styles from './PlaceholderHome.module.css';

interface PlaceholderHomeProps {
  repo: Pick<Repository, 'getProfile' | 'countCards'>;
}

/** Temporary home after sign-in, so sign-in can be tested on the phone. Replaced in roadmap 7.9. */
export function PlaceholderHome({ repo }: PlaceholderHomeProps) {
  const profile = useLiveQuery(() => repo.getProfile(), [repo]);
  const cards = useLiveQuery(() => repo.countCards(), [repo]);
  const name = profile?.displayName;

  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>
        {name ? `${name}'s Leitner` : 'Leitner'}
        <span className={styles.dot}>.</span>
      </h1>
      <p className={styles.pill}>You're signed in</p>
      {cards !== undefined && (
        <p className={styles.subtitle}>
          {cards === 1 ? '1 word in your box.' : `${cards} words in your box.`} Review screens are
          coming soon.
        </p>
      )}
    </main>
  );
}
