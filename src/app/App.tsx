import styles from './App.module.css';

/**
 * Placeholder shell. Proves the pipeline end to end (tokens, fonts, PWA, deploy).
 * Real screens are built in step 7 — see docs/roadmap.md.
 */
export function App() {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>
        Leitner<span className={styles.dot}>.</span>
      </h1>
      <p className={styles.subtitle}>Coming soon — the box is being built.</p>
      <button type="button" className={styles.button}>
        Knew it!
      </button>
    </main>
  );
}
