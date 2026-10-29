# Design tokens

Implemented in `src/styles/tokens.css`. Use `var(--token)`; Stylelint blocks raw values elsewhere.

## Colour

| Token                    | Hex              | Role                                                                                                                       |
| ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--color-bg`             | #FFF3E4          | App background                                                                                                             |
| `--color-cream`          | #FFEAD3          | Soft fills, card stack, Persian bubble, mascot circles                                                                     |
| `--color-aqua`           | #BFE7EA          | Synonym chips, practice/all-done panels, KNEW IT stamp, mascot body                                                        |
| `--color-aqua-dark`      | #8FD0D6          | Mascot back wall                                                                                                           |
| `--color-orange`         | #E89B5B          | Review & session-complete panels, streak flame, progress fill                                                              |
| `--color-terracotta`     | #D46743          | Accents (mascot card, confetti dots, wordmark dot)                                                                         |
| `--color-focus-ring`     | terracotta / ink | Keyboard focus ring: terracotta on cream and white, ink on orange and aqua panels (set by `BottomPanel`; audit 2026-10-29) |
| `--color-ink`            | #2B1D16          | Text, outlines, primary button                                                                                             |
| `--color-text-secondary` | #6E5648          | Labels, helper text                                                                                                        |
| `--color-error`          | #B5502E          | Validation messages                                                                                                        |
| `--color-white`          | #FFFFFF          | Inputs, pills, text on ink buttons                                                                                         |
| `--color-black`          | #000000          | Only the shadow under ink buttons                                                                                          |
| `--color-line`           | #D9C3AE          | Sheet handle, empty-field outline, soft dividers                                                                           |
| `--color-overlay`        | #2B1D16 at 45%   | Dim layer behind sheets and dialogs                                                                                        |

## Type

| Token            | Value                                      |
| ---------------- | ------------------------------------------ |
| `--font-ui`      | Nunito (self-hosted)                       |
| `--font-persian` | Vazirmatn (Persian text only, `lang="fa"`) |
| `--weight-bold`  | 800, labels & buttons                      |
| `--weight-black` | 900, big words & titles                    |

## Shape & depth

| Token                     | Value                            |
| ------------------------- | -------------------------------- |
| `--radius-card`           | 40px                             |
| `--radius-panel`          | 52px, review / practice panels   |
| `--radius-panel-tall`     | 56px, complete / all done panels |
| `--radius-sheet`          | 44px, add / edit sheet           |
| `--radius-input`          | 22px                             |
| `--radius-stamp`          | 18px, KNEW IT! / NOT YET stamps  |
| `--radius-highlight`      | 6px, word marked in a sentence   |
| `--radius-pill`           | 999px                            |
| `--border-chunky`         | 2.5px                            |
| `--press-depth`           | 5px                              |
| `--press-depth-sm`        | 4px (round + button)             |
| `--shadow-hard`           | 0 5px 0 ink                      |
| `--shadow-hard-on-ink`    | 0 5px 0 black (ink buttons)      |
| `--shadow-hard-sm`        | 0 3px 0 ink (top-bar stat pills) |
| `--shadow-hard-on-ink-sm` | 0 4px 0 black (round + button)   |
| `--shadow-card`           | 0 6px 0 ink (word card, dialog)  |

## Spacing

4px base: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · `--space-6` 32 · `--space-7` 48

## Layout

`--column-desktop` 560px: on screens 700px and wider (laptop, tablet) the whole app sits in a centred 560px column, and the add / edit sheet becomes a centred modal (roadmap 7.13). The 700px breakpoint can't be a CSS variable (media queries don't read them), so it is written in `global.css` and `Sheet.module.css`.

## Motion

`--ease-bounce` cubic-bezier(0.34, 1.56, 0.64, 1) · `--duration-fast` 120ms · `--duration-base` 240ms · `--duration-slow` 420ms (celebrations) · `--stagger` 70ms · `--hover-lift` 2px with `--shadow-hard-lifted` / `--shadow-hard-on-ink-sm-lifted` (laptop hover). `prefers-reduced-motion` is respected globally (durations and delays). Full motion spec: [motion.md](motion.md).
