import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * "primary": the orange pill with an ink outline (Save word, Sign in; on aqua panels).
   * "aqua": the aqua pill with an ink outline ("Knew it!"; on orange panels).
   * "secondary": the cream pill with an ink outline (Not yet).
   * "text": a quiet link-style button.
   */
  variant?: 'primary' | 'aqua' | 'secondary' | 'text';
}

/** Squishy pill button (docs/design: drops 5px and loses its shadow when pressed). */
export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
