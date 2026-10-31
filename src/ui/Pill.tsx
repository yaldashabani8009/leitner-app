import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Pill.module.css';

interface PillProps {
  /**
   * "stat": white pill with a hard shadow and an icon (top bar: words learned, streak).
   * "tag": aqua chip (similar words on the card back).
   * "label": small soft pill ("do you know it?", "one more look").
   */
  variant: 'stat' | 'tag' | 'label';
  /** Fill for "label" pills: cream on review cards, aqua in the practice round. */
  tone?: 'cream' | 'aqua';
  icon?: ReactNode;
  /**
   * Full text for screen readers when the visible text alone isn't clear,
   * e.g. a stat pill shows "12" but reads "12-day streak".
   */
  srLabel?: string;
  className?: string;
  /** Makes the pill a button (the top-bar box badge opens all words). */
  onClick?: () => void;
  children: ReactNode;
}

/** A full pill; a button when `onClick` is given. For a tappable dashed pill, use AddPill. */
export function Pill({
  variant,
  tone = 'cream',
  icon,
  srLabel,
  className,
  onClick,
  children,
}: PillProps) {
  const classes = [styles.pill, styles[variant], variant === 'label' && styles[tone], className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {icon}
      {srLabel ? (
        <>
          <span aria-hidden="true">{children}</span>
          <span className={styles.srOnly}>{srLabel}</span>
        </>
      ) : (
        children
      )}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${classes} ${styles.tappable}`} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <span className={classes}>{content}</span>;
}

type AddPillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Shown after the "+", e.g. "similar word". */
  children: string;
};

/** Dashed "+ similar word" pill in the add / edit sheet: a real button. */
export function AddPill({ children, type = 'button', className, ...rest }: AddPillProps) {
  return (
    <button
      type={type}
      className={[styles.pill, styles.add, className].filter(Boolean).join(' ')}
      {...rest}
    >
      + {children}
    </button>
  );
}
