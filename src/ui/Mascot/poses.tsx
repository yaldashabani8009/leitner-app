import type { ReactNode } from 'react';
import styles from './Mascot.module.css';

/**
 * The 8 poses from the "Mascot mix" board on the design canvas (docs/design/README.md).
 * Every pose uses the same parts; only these numbers and extras change.
 * Coordinates are in the canvas's viewBox (-6 -6 132 124).
 */
export type MascotPose =
  'wave' | 'idle' | 'happy' | 'cheer' | 'celebrate' | 'flame' | 'sleep' | 'write';

export const MASCOT_POSES: readonly MascotPose[] = [
  'wave',
  'idle',
  'happy',
  'cheer',
  'celebrate',
  'flame',
  'sleep',
  'write',
];

type Eyes =
  { kind: 'dots'; left: [number, number]; right: [number, number] } | { kind: 'arcs'; d: string };

export interface PoseSpec {
  /** Read by screen readers. */
  label: string;
  /** Moves the whole mascot (hop, lean). */
  bodyTransform?: string;
  legs: string;
  armLeft: string;
  armRight: string;
  /** Tilt of the three index cards: terracotta, orange, cream. */
  cards: [string, string, string];
  /** Writing lines on the cream card; none when the cards jump. */
  cardLines?: { d: string; transform: string };
  eyes: Eyes;
  mouth: ReactNode;
  /** Under everything (shadow, confetti). */
  behind?: ReactNode;
  /** Held in the hands, drawn behind the box (heart, flame, pencil, wave lines). */
  held?: ReactNode;
  /** On top of everything (z z z). */
  front?: ReactNode;
}

const LEGS = 'M36 100 L34 112 M78 100 L80 112';
const LEGS_HOP = 'M36 100 L28 110 M78 100 L86 110';
const ARM_LEFT = 'M18 72 L2 84';
const CARDS: PoseSpec['cards'] = ['rotate(-8 56 34)', 'rotate(6 66 30)', 'rotate(-2 61 37)'];
const CARD_LINES = { d: 'M44 30 H66 M44 37 H74', transform: 'rotate(-2 61 37)' };
const DOT_EYES: Eyes = { kind: 'dots', left: [44, 74], right: [68, 74] };
const HAPPY_EYES: Eyes = { kind: 'arcs', d: 'M39 76 Q44 68 49 76 M63 76 Q68 68 73 76' };

function smile(d: string) {
  return <path d={d} className={styles.line} strokeWidth="3" />;
}

function openMouth(d: string) {
  return <path d={d} className={styles.ink} strokeWidth="2" />;
}

export const POSES: Record<MascotPose, PoseSpec> = {
  wave: {
    label: 'Box mascot waving',
    legs: LEGS,
    armLeft: ARM_LEFT,
    armRight: 'M94 66 L118 50',
    cards: CARDS,
    cardLines: CARD_LINES,
    eyes: DOT_EYES,
    mouth: smile('M50 84 Q56 90 62 84'),
    held: (
      <path
        d="M122 40 Q127 46 124 52 M118 36 Q124 33 128 38"
        className={`${styles.line} ${styles.waveLines}`}
        strokeWidth="2.5"
      />
    ),
  },
  idle: {
    label: 'Box mascot idle',
    legs: LEGS,
    armLeft: ARM_LEFT,
    armRight: 'M94 68 L116 78',
    cards: CARDS,
    cardLines: CARD_LINES,
    eyes: DOT_EYES,
    mouth: smile('M51 84 Q56 89 61 84'),
  },
  happy: {
    label: 'Box mascot happy',
    bodyTransform: 'translate(0 -6)',
    legs: LEGS_HOP,
    armLeft: 'M18 68 L6 54',
    armRight: 'M94 62 L118 48',
    cards: [
      'translate(0 -5) rotate(-14 56 34)',
      'translate(0 -4) rotate(12 66 30)',
      'translate(0 -3) rotate(-2 61 37)',
    ],
    eyes: HAPPY_EYES,
    mouth: openMouth('M48 82 Q56 96 64 82 Z'),
    behind: <ellipse cx="60" cy="116" rx="30" ry="3" className={styles.shadow} />,
  },
  cheer: {
    label: 'Box mascot giving a warm nod',
    bodyTransform: 'rotate(-6 60 76)',
    legs: LEGS,
    armLeft: ARM_LEFT,
    armRight: 'M94 64 L114 52',
    cards: CARDS,
    cardLines: CARD_LINES,
    eyes: { kind: 'arcs', d: 'M39 73 Q44 77 49 73 M63 73 Q68 77 73 73' },
    mouth: smile('M51 84 Q56 89 61 84'),
    held: (
      <path
        d="M114 38 C111 33 104 36 107 41 L114 48 L121 41 C124 36 117 33 114 38 Z"
        className={styles.heart}
        strokeWidth="2.5"
      />
    ),
  },
  celebrate: {
    label: 'Box mascot celebrating',
    bodyTransform: 'translate(0 -8)',
    legs: LEGS_HOP,
    armLeft: 'M18 66 L8 44',
    armRight: 'M94 60 L114 38',
    cards: [
      'translate(-6 -12) rotate(-24 56 34)',
      'translate(6 -14) rotate(20 66 30)',
      'translate(0 -6) rotate(-2 61 37)',
    ],
    eyes: HAPPY_EYES,
    mouth: openMouth('M47 81 Q56 99 65 81 Z'),
    behind: (
      <g className={styles.confetti}>
        <path
          d="M0 18 L6 12 M124 14 L116 8 M14 2 L16 10"
          className={styles.confettiLine}
          strokeWidth="3"
        />
        <circle cx="104" cy="2" r="3" className={styles.orange} />
        <circle cx="22" cy="30" r="2.5" className={styles.ink} />
        <path d="M112 26 L116 20 L120 28 Z" className={styles.confettiTriangle} strokeWidth="1.5" />
      </g>
    ),
  },
  flame: {
    label: 'Box mascot holding a flame',
    legs: LEGS,
    armLeft: ARM_LEFT,
    armRight: 'M94 68 L116 58',
    cards: CARDS,
    cardLines: CARD_LINES,
    eyes: { kind: 'dots', left: [46, 73], right: [70, 73] },
    mouth: smile('M51 83 Q57 90 63 83'),
    held: (
      <>
        <circle cx="117" cy="40" r="15" className={styles.glow} />
        <g className={styles.flameShape}>
          <path
            d="M117 24 C124 33 128 38 124 47 C121 53 112 53 110 47 C107 41 111 36 113 33 C114 37 116 38 118 37 C119 33 118 28 117 24 Z"
            className={styles.flameOuter}
            strokeWidth="2.5"
          />
          <path
            d="M117 40 C120 43 120 48 117 50 C114 48 114 43 117 40 Z"
            className={styles.flameInner}
          />
        </g>
      </>
    ),
  },
  sleep: {
    label: 'Box mascot sleeping',
    legs: LEGS,
    armLeft: 'M18 76 L6 90',
    armRight: 'M94 72 L110 86',
    cards: [
      'translate(0 8) rotate(-3 56 34)',
      'translate(0 8) rotate(2 66 30)',
      'translate(0 8) rotate(-1 61 37)',
    ],
    eyes: { kind: 'arcs', d: 'M39 74 Q44 78 49 74 M63 74 Q68 78 73 74' },
    mouth: <ellipse cx="56" cy="87" rx="3.5" ry="2.5" className={styles.ink} />,
    front: (
      <g className={styles.zzz}>
        <text x="96" y="26" fontSize="16" className={styles.z}>
          z
        </text>
        <text x="108" y="14" fontSize="12" className={styles.z}>
          z
        </text>
        <text x="117" y="5" fontSize="9" className={styles.z}>
          z
        </text>
      </g>
    ),
  },
  write: {
    label: 'Box mascot writing with a pencil',
    legs: LEGS,
    armLeft: ARM_LEFT,
    armRight: 'M94 70 L116 62',
    cards: ['rotate(-8 56 34)', 'rotate(6 66 30)', 'translate(0 -10) rotate(-2 61 37)'],
    cardLines: { d: 'M44 20 H66 M44 27 H58', transform: 'rotate(-2 61 27)' },
    eyes: { kind: 'dots', left: [47, 73], right: [71, 73] },
    mouth: (
      <>
        {smile('M52 84 Q57 88 62 84')}
        <path d="M59 86 Q61 92 64 87" className={styles.tongue} strokeWidth="2" />
      </>
    ),
    held: (
      <g className={styles.pencil}>
        <g transform="rotate(30 116 50)">
          <rect
            x="111"
            y="28"
            width="10"
            height="34"
            rx="2"
            className={styles.pencilBody}
            strokeWidth="2.5"
          />
          <rect
            x="111"
            y="24"
            width="10"
            height="7"
            rx="2"
            className={styles.pencilEraser}
            strokeWidth="2.5"
          />
          <path d="M111 62 L116 72 L121 62 Z" className={styles.pencilTip} strokeWidth="2.5" />
        </g>
      </g>
    ),
  },
};
