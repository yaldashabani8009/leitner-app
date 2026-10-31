# ADR-021: Spelling audio: built-in speech and the iPhone sound unlock

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The Spelling deck (v3 step 5) says each word aloud and asks you to type it. The app must stay free and work offline, and iPhone Safari (installed on the Home Screen) only lets a page start sound from a user's touch.

## Options considered

1. **Recorded audio or a cloud voice:** natural, but costs money, needs a network and storage per word.
2. **The phone's built-in voice through the Web Speech API (`speechSynthesis`):** free, offline, any word; quality depends on the phone's voices.

## Decision

Option 2 (`src/services/speech.ts`).

- **Voice:** American English. Once `voiceschanged` has fired: an `en-US` voice named "Enhanced" or "Premium", else the default `en-US` voice, else any `en-US`, else any English voice. Normal rate 0.9, slow ("snail") 0.55. `cancel()` before every `speak()`.
- **The unlock:** the first spelling card of a session shows a big "Tap to start" speaker; that tap plays the word and unlocks sound. After that, each next word is spoken **synchronously inside the user's own action**: the Check press (button or Return), the correct retype, "Sounds the same, count it", or in Mix them all the swipe or button that ends the previous card. Never in a `useEffect` after render or after a `setTimeout`.
- **Safety net:** no `start` event within about 1 s, or the app came back from the background (`visibilitychange`), makes the state "blocked": the speaker gently pulses with the label "Tap to hear" (a static ring with Reduce motion).

## Consequences

- Must be checked on the real iPhone (Home Screen app): the automatic tests use a fake browser voice. If real-phone testing shows the unlock lasts the whole session, a short delay before the next word may be added and recorded here.
- A paid natural voice stays on the future list.
