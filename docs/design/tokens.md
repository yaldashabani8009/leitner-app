# Design tokens

Implemented in `src/styles/tokens.css`. Use `var(--token)`; Stylelint blocks raw values elsewhere.

## Colour
| Token | Hex | Role |
|---|---|---|
| `--color-bg` | #FFF3E4 | App background |
| `--color-cream` | #FFEAD3 | Soft fills, card stack, Persian bubble, mascot circles |
| `--color-aqua` | #BFE7EA | Synonym chips, practice/all-done panels, KNEW IT stamp, mascot body |
| `--color-aqua-dark` | #8FD0D6 | Mascot back wall |
| `--color-orange` | #E89B5B | Review & session-complete panels, streak flame, progress fill |
| `--color-terracotta` | #D46743 | Accents (mascot card, confetti dots, wordmark dot) |
| `--color-ink` | #2B1D16 | Text, outlines, primary button |
| `--color-text-secondary` | #6E5648 | Labels, helper text |
| `--color-error` | #B5502E | Validation messages |

## Type
| Token | Value |
|---|---|
| `--font-ui` | Nunito (self-hosted) |
| `--font-persian` | Vazirmatn (Persian text only, `lang="fa"`) |
| `--weight-bold` | 800, labels & buttons |
| `--weight-black` | 900, big words & titles |

## Shape & depth
| Token | Value |
|---|---|
| `--radius-card` | 40px |
| `--radius-panel` | 54px |
| `--radius-input` | 22px |
| `--radius-pill` | 999px |
| `--border-chunky` | 2.5px |
| `--press-depth` | 5px |
| `--shadow-hard` | 0 5px 0 ink |

## Spacing
4px base: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · `--space-6` 32 · `--space-7` 48

## Motion
`--ease-bounce` cubic-bezier(0.34, 1.56, 0.64, 1) · `--duration-fast` 120ms · `--duration-base` 240ms. `prefers-reduced-motion` is respected globally.
