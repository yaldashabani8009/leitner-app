import { POSES, type MascotPose } from './poses';
import styles from './Mascot.module.css';
import { useReducedMotion } from './useReducedMotion';

export type { MascotPose } from './poses';

interface MascotProps {
  pose: MascotPose;
  /** "large": 190px with legs (session complete, all done). "small": 84px, no legs (panels, sheets). */
  size?: 'large' | 'small';
  /** White body on the practice screen (docs/design). */
  body?: 'aqua' | 'white';
  /** Hide from screen readers when the screen already says the same thing. */
  decorative?: boolean;
  /** Turn the pose's little movement off (it is always off with "Reduce motion"). */
  still?: boolean;
  className?: string;
}

const SIZE_PX = { large: 190, small: 84 };

/**
 * The box mascot, drawn from separate parts so each can move on its own (roadmap 7.8).
 * Screens only pass a pose; the drawing lives in poses.tsx, so the mascot can be redrawn
 * later without touching any screen.
 */
export function Mascot({
  pose,
  size = 'large',
  body = 'aqua',
  decorative = false,
  still = false,
  className,
}: MascotProps) {
  const reducedMotion = useReducedMotion();
  const spec = POSES[pose];
  const moving = !still && !reducedMotion;
  const px = SIZE_PX[size];
  const classes = [
    styles.mascot,
    body === 'white' && styles.whiteBody,
    moving && styles[pose],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      // A new pose starts its movement from the beginning.
      key={pose}
      width={px}
      height={px}
      viewBox="-6 -6 132 124"
      className={classes}
      data-pose={pose}
      data-moving={moving}
      {...(decorative
        ? { 'aria-hidden': true, focusable: false }
        : { role: 'img', 'aria-label': spec.label })}
    >
      {spec.behind}
      <g className={styles.body}>
        <g transform={spec.bodyTransform}>
          {size === 'large' && (
            <path d={spec.legs} className={styles.limb} strokeWidth="3.5" data-part="legs" />
          )}
          <path d={spec.armLeft} className={styles.limb} strokeWidth="3.5" />
          <path
            d={spec.armRight}
            className={`${styles.limb} ${styles.armRight}`}
            strokeWidth="3.5"
          />
          {spec.held}
          <rect
            x="20"
            y="32"
            width="72"
            height="40"
            rx="14"
            className={styles.backWall}
            strokeWidth="3"
          />
          <g className={styles.cards} strokeWidth="3">
            <g transform={spec.cards[0]}>
              <rect x="32" y="16" width="48" height="36" rx="4" className={styles.cardTerracotta} />
            </g>
            <g transform={spec.cards[1]}>
              <rect x="76" y="5" width="13" height="9" rx="2" className={styles.cardOrange} />
              <rect x="42" y="12" width="48" height="40" rx="4" className={styles.cardOrange} />
            </g>
            <g transform={spec.cards[2]}>
              <rect x="40" y="15" width="13" height="9" rx="2" className={styles.cardCream} />
              <rect x="36" y="20" width="50" height="34" rx="4" className={styles.cardCream} />
            </g>
          </g>
          {spec.cardLines && (
            <path
              d={spec.cardLines.d}
              transform={spec.cardLines.transform}
              className={styles.cardLines}
              strokeWidth="2.5"
            />
          )}
          <rect
            x="18"
            y="46"
            width="76"
            height="54"
            rx="16"
            className={styles.front}
            strokeWidth="3"
          />
          <rect
            x="44"
            y="52"
            width="24"
            height="10"
            rx="5"
            className={styles.slot}
            strokeWidth="2.5"
          />
          {spec.eyes.kind === 'dots' ? (
            <>
              <circle
                cx={spec.eyes.left[0]}
                cy={spec.eyes.left[1]}
                r="4.5"
                className={styles.ink}
              />
              <circle
                cx={spec.eyes.right[0]}
                cy={spec.eyes.right[1]}
                r="4.5"
                className={styles.ink}
              />
            </>
          ) : (
            <path d={spec.eyes.d} className={styles.line} strokeWidth="3.5" />
          )}
          <circle cx="35" cy="83" r="4" className={styles.orange} />
          <circle cx="77" cy="83" r="4" className={styles.orange} />
          {spec.mouth}
          {spec.front}
        </g>
      </g>
    </svg>
  );
}
