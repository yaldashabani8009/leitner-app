import type { ReactNode, SVGProps } from 'react';
import styles from './icons.module.css';

/** Small stroke icons from the canvas. Decorative: the button or pill around them carries the name. */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Icon({ size = 18, className, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={[styles.icon, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Open book: words learned. */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Icon>
  );
}

/** A cardboard box in the flame's style (cream fill, ink outline): every card in your box. */
export function BoxIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={[styles.box, className].filter(Boolean).join(' ')} {...props}>
      <path d="M3 8l9-4 9 4v9l-9 4-9-4z" />
      <path className={styles.boxLine} d="M3 8l9 4 9-4M12 12v9" />
    </Icon>
  );
}

/** House: back to the Today screen from a session (canvas N6). */
export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

/** Chevron pointing left: back (canvas N8). */
export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  );
}

/** Orange flame: streak. */
export function FlameIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={[styles.flame, className].filter(Boolean).join(' ')} {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M12 5v14" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </Icon>
  );
}

/** Circular arrow: "tap to flip", practice round. */
export function FlipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </Icon>
  );
}
