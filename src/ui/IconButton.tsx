import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /** What the button does, for screen readers ("Add word", "Edit word"). Required: there is no visible text. */
  label: string;
  icon: ReactNode;
  /** "ink": 52px round ink button (top bar +). "cream": 44px round cream button (pencil on the card back). */
  variant?: 'ink' | 'cream';
}

/** Round icon-only button; squishes like the big pill buttons. */
export function IconButton({
  label,
  icon,
  variant = 'ink',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  return (
    <button type={type} aria-label={label} className={classes} {...rest}>
      {icon}
    </button>
  );
}
