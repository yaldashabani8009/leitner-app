import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /** What the button does, for screen readers ("Add word", "Edit word"). Required: there is no visible text. */
  label: string;
  icon: ReactNode;
  /**
   * "primary": 52px round orange button with an ink outline (top bar +).
   * "cream": 44px round cream button (pencil on the card back).
   * "white": 44px round white button (✕ in the add / edit sheet).
   * "whiteRaised": 52px white button with the + button's shadow (✕ of the rolled-out +, canvas N2).
   */
  variant?: 'primary' | 'cream' | 'white' | 'whiteRaised';
  ref?: Ref<HTMLButtonElement>;
}

/** Round icon-only button; squishes like the big pill buttons. */
export function IconButton({
  label,
  icon,
  variant = 'primary',
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
