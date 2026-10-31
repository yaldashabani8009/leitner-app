import { useReducedMotion } from '../useReducedMotion';
import styles from './DjMascot.module.css';

interface DjMascotProps {
  /** Width in px; the height follows the drawing (canvas N1: 130 × 141). */
  width?: number;
  decorative?: boolean;
  className?: string;
}

/**
 * The DJ pose (board "Mascot · DJ", 31 Oct): the box mascot with no cards inside, black
 * headphones, sunglasses, one fist up and one hand scratching a record on a little mixer,
 * music notes around. The only playful element on the calm Today screen. Its head bobs and
 * the notes drift; both stop with Reduce motion.
 */
export function DjMascot({ width = 130, decorative = false, className }: DjMascotProps) {
  const moving = !useReducedMotion();
  return (
    <svg
      width={width}
      height={Math.round((width * 141) / 130)}
      viewBox="-24 -42 160 174"
      className={[styles.dj, moving && styles.moving, className].filter(Boolean).join(' ')}
      {...(decorative
        ? { 'aria-hidden': true, focusable: false }
        : { role: 'img', 'aria-label': 'The mascot as a DJ' })}
    >
      <g className={styles.notes}>
        <ellipse cx="-12" cy="22" rx="4.5" ry="3.5" transform="rotate(-20 -12 22)" />
        <path className={styles.noteStem} d="M-8 21 V6 L0 3" />
        <ellipse cx="124" cy="8" rx="4.5" ry="3.5" transform="rotate(-20 124 8)" />
        <path className={styles.noteStem} d="M128 7 V-10" />
        <path className={styles.noteStem} d="M128 -10 Q133 -6 134 -1" />
      </g>
      <g className={styles.body}>
        <path className={styles.arm} d="M18 90 L-6 64" />
        <circle className={styles.hand} cx="-7" cy="62" r="4.5" />
        <path className={styles.band} d="M11.5 56 C5 -6 107 -6 100.5 56" />
        <path className={styles.shine} d="M30 22 Q42 13 56 12" />
        <rect className={styles.back} x="20" y="32" width="72" height="40" rx="14" />
        <rect className={styles.front} x="18" y="46" width="76" height="54" rx="16" />
        <rect className={styles.slot} x="44" y="52" width="24" height="10" rx="5" />
        <rect className={styles.cup} x="2" y="52" width="18" height="30" rx="8" />
        <rect className={styles.cup} x="92" y="52" width="18" height="30" rx="8" />
        <path className={styles.cupShine} d="M6 58 V70 M96 58 V70" />
        <path className={styles.frameArm} d="M20 70 L32 70 M80 70 L92 70" />
        <rect className={styles.lens} x="31" y="65" width="22" height="14" rx="6" />
        <rect className={styles.lens} x="59" y="65" width="22" height="14" rx="6" />
        <path className={styles.bridge} d="M53 70 Q56 67 59 70" />
        <path className={styles.glint} d="M35 70 L40 67 M37 75 L45 69" />
        <path className={styles.glint} d="M63 70 L68 67 M65 75 L73 69" />
        <circle className={styles.cheek} cx="33" cy="86" r="4" />
        <circle className={styles.cheek} cx="79" cy="86" r="4" />
        <path className={styles.mouth} d="M47 84 Q56 95 65 84 Z" />
      </g>
      <path className={styles.arm} d="M94 90 L108 98" />
      <rect className={styles.mixer} x="-14" y="100" width="140" height="28" rx="12" />
      <ellipse className={styles.record} cx="16" cy="100" rx="22" ry="6.5" />
      <ellipse className={styles.labelOrange} cx="16" cy="100" rx="5" ry="1.8" />
      <ellipse className={styles.record} cx="96" cy="100" rx="22" ry="6.5" />
      <ellipse className={styles.labelAqua} cx="96" cy="100" rx="5" ry="1.8" />
      <circle className={styles.hand} cx="108" cy="98" r="4.5" />
      <path className={styles.fader} d="M42 118 H70" />
      <rect className={styles.knob} x="50" y="113" width="8" height="10" rx="3" />
    </svg>
  );
}
