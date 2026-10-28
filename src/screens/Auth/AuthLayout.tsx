import type { ReactNode } from 'react';
import styles from './Auth.module.css';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared frame for Sign in / Sign up / Forgot password: wordmark, a touch of confetti, the form. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className={styles.screen}>
      <Confetti />
      <div className={styles.column}>
        <p className={styles.wordmark}>
          Leitner<span className={styles.dot}>.</span>
        </p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}

/** Memphis confetti from the Loading screen (docs/design: sparkles, triangles, dots). */
function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      <svg className={styles.sparkle} width="26" height="26" viewBox="0 0 24 24">
        <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
      </svg>
      <svg className={styles.triangle} width="34" height="34" viewBox="0 0 24 24">
        <path d="M12 3L22 20H2Z" />
      </svg>
      <span className={styles.dotTerracotta} />
      <span className={styles.dotInk} />
    </div>
  );
}
