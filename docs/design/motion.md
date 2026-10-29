# Motion (roadmap step 4, final version 2026-10-29)

Motion in Leitner has three jobs, and nothing moves without one of them:

1. **Confirm** what you just did: the button squishes, the card flies off the way you swiped, the mascot hops or nods.
2. **Guide** your eye to what's next: the next card is dealt from the stack; a rest screen's panel slides up with its buttons.
3. **Celebrate**, briefly, when you finish: Session complete is the only big moment.

Rules: motion never blocks input (nothing waits for an animation, except the 220ms card fly-out); repeating loops are slow and small; **"Reduce motion" on the phone turns everything off** (`global.css` cuts every animation and transition to an instant, delays included; the mascot stands still).

## Timing tokens (`src/styles/tokens.css`)

| Token             | Value                        | Used for                                                              |
| ----------------- | ---------------------------- | --------------------------------------------------------------------- |
| `--duration-fast` | 120ms                        | press and hover                                                       |
| `--duration-base` | 240ms                        | card flip and deal, sheets, panels, words rising in                   |
| `--duration-slow` | 420ms                        | celebrations: mascot circle, speech bubble, confetti                  |
| `--stagger`       | 70ms                         | between pieces that arrive one after another                          |
| `--ease-bounce`   | cubic-bezier(.34,1.56,.64,1) | things arriving or pressed (playful overshoot)                        |
| `ease-out`        | built in                     | things fading or sliding into place                                   |
| `--hover-lift`    | 2px                          | laptop hover: the button rises, its hard shadow grows by the same 2px |

## What moves, where

| Moment                 | Motion                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                | Mascot circle pops in → name rises in → streak pill pops in (70ms apart). Sparkles twinkle slowly. Mascot waves.                              |
| Card front             | Each card is **dealt** from the stack: rises 18px, turns from −3°, fades in (240ms, bounce). Mascot bobs.                                     |
| Flip                   | The back turns in (rotateY, 240ms).                                                                                                           |
| Swipe / answer         | Card follows the finger with a slight tilt; KNEW IT! / NOT YET stamps fade in; flies off 220ms. Mascot hops (knew it) or nods (not yet).      |
| Progress bar           | Fills smoothly (240ms).                                                                                                                       |
| Session complete       | Mascot circle pops in (420ms) → words rise in → speech bubble pops in → confetti pops in piece by piece → panel slides up. Mascot hops twice. |
| All done / Resting     | Same arrival, calmer: no bubble; sparkles twinkle slowly; mascot sleeps (z z z float up).                                                     |
| Add / edit sheet       | Phone: slides up; drag the handle down to close. Laptop: pops in as a centred modal. Overlay fades.                                           |
| Dialogs                | Pop in (scale 0.9 → 1, bounce).                                                                                                               |
| Buttons                | Press: drop 5px, shadow gone. **Laptop hover:** rise 2px, shadow 5px → 7px; round pencil / ✕ grow 6%. Never on touch screens.                 |
| Review screen confetti | Still (nothing should pull your eye while you think).                                                                                         |

## Tuning

Every number above is a token or sits next to its keyframes, so a change is one line. To try a change, run `npm run dev` and open `?demo` (`&complete` for Session complete, `&empty` for All done).
