import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * "primary": the big ink pill (Save word, Sign in, Knew it!).
   * "secondary": the cream pill with an ink outline (Not yet).
   * "text": a quiet link-style button.
   */
  variant?: 'primary' | 'secondary' | 'text';
}

/** Squishy pill button (docs/design: drops 5px and loses its shadow when pressed). */
export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
