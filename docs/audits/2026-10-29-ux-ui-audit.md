# Leitner — UX/UI and accessibility audit (2026-10-29)

**Scope:** the real study screens on the dev `?demo` page (sample words) and the Sign in screen: sign in, card front, card back, add word with errors, Session complete, empty box, "Save a copy?", "Have a backup file?". **Viewports:** iPhone 393×852 (touch) and laptop 1440×900. Chromium; WebKit not available in this session. The live site couldn't be reached from the session, so the published build wasn't audited directly (the live smoke check covers it after every deploy).

**Method:** measurement scripts on every screen (contrast, tap targets, accessible names, headings, forms, layout, focus ring, interaction states, English and Persian text checks), the accessibility tree, a keyboard-only walk through a session, and a reading pass over all visible text. Accessibility findings cite WCAG 2.2; the rest are judgement, argued from usability heuristics. Project standards (`docs/design/README.md`) take precedence.

## Summary

| Severity      | Count | Status                                        |
| ------------- | ----- | --------------------------------------------- |
| Accessibility | 2     | 01 fixed (option B) · 02 fixed                |
| Major         | 1     | 03 fixed (option A)                           |
| Note          | 3     | 05 fixed · 04 with the motion pass · 06 noted |

The foundations are strong: no text contrast failures, no tap target under 44px, no unnamed control, no console errors and no overflow on any of the 12 screens measured.

## Findings

### 01 · Accessibility · Session complete, All done, practice round, "Open my card"

The keyboard focus ring disappears against the orange and aqua panels.

Anyone using a keyboard (laptop) can't see which button is selected on the screens with coloured panels.

```
focus ring: 3px solid rgb(212,103,67) (terracotta), offset 3px
on orange panel #E89B5B → 1.59:1   FAIL (SC 1.4.11 needs ≥ 3:1)
on aqua panel   #BFE7EA → 2.72:1   FAIL
on cream page   #FFF3E4 → 3.30:1   pass
on white card   #FFFFFF → 3.61:1   pass
same ring in ink #2B1D16: 7.19 · 12.27 · 14.88 · 16.28 (all pass)
```

**Options (Yali's decision):** A. ink ring everywhere (simplest, always passes) · B. ink ring only on orange / aqua panels, terracotta stays on cream and white (keeps the current look where it works) · C. two-tone ring (ink outline + cream gap). **Yali chose B (2026-10-29); built:** `--color-focus-ring` is terracotta by default and ink inside `BottomPanel` orange / aqua. Re-measured: 7.19:1 on orange, 12.27:1 on aqua, 3.30:1 on cream, 3.61:1 on the white answer panel.

### 02 · Accessibility · Review — **fixed in this PR**

After answering a card with the keyboard, focus was thrown away to the page.

A keyboard or screen-reader user lost their place after every answer and heard nothing about the next card (SC 2.4.3 Focus Order).

```
keyboard walk, 3 cards (Enter to flip, Enter on "Knew it!"):
card 1 after answering → focus on BODY
card 2 after answering → focus on BODY
card 3 after answering → focus on BODY
after the fix:
card 1 → BUTTON "do you know it? brave …"   card 2 → BUTTON "… meticulous …"
```

**Fix:** after an answer given while something on the card had focus, the next card's front gets focus. Touch taps on iPhone don't focus buttons, so phones are unaffected. Test: `StudyFlow.test.tsx` "after answering with the keyboard…". **Follow-up, also fixed:** after the last keyboard answer, focus moves to the "Session complete!" heading.

### 03 · Major · Sign in

"Create an account" leads to a form that always fails while sign-ups are closed.

Anyone who taps it (a friend you show the app to, or you on a new phone) fills in a form and only then reads "Sign-ups are closed for now." It's a dead end on the very first screen.

```
Sign in screen text: "Welcome back" · "Sign in" · "Forgot password?" · "Create an account"
ADR-010: sign-ups are off in Supabase; AUTH_MESSAGES.signupsClosed = "Sign-ups are closed for now."
```

**Options:** A. hide "Create an account" while sign-ups are closed (one setting to flip when they open) · B. keep it, but say "Sign-ups are closed for now" on the Sign in screen instead of a link · C. leave as is. **Recommendation: A. Yali chose A (2026-10-29); built:** hidden behind `SIGNUPS_OPEN` in `src/app/features.ts`, to flip together with the Supabase setting.

### 04 · Note · Laptop

Buttons don't react when the mouse hovers over them.

On a laptop there is no hint that something is clickable until you click it (the chunky press effect only shows while pressing).

```
stylesheets read: 20 of 20 · :hover rules: 0 · :active rules: 4 · :focus-visible rules: 5
```

**Options:** A. a small lift on hover (shadow 5px → 7px), mouse and trackpad only · B. leave as is (phones never hover). **Recommendation: A**, as part of the final motion pass (roadmap step 4).

### 05 · Note · Empty box (new account)

Screen readers say "0 words learned, 0-day streak".

"0-day streak" reads oddly; the pills are honest, but the spoken label could be friendlier.

```
accessibility tree (empty box): text: "0 words learned 0-day streak"
```

**Option:** say "no streak yet" for 0 (the pill itself still shows 0). **Yali said yes (2026-10-29); built.**

### 06 · Note · All screens

Every piece of text is semibold or heavier.

This is the house style (chunky Nunito 600–900), so weight barely separates levels; size and colour do that work instead. Not a defect; noted so it's a deliberate choice.

```
text on screen that is ≥ semibold: 100% on every screen (e.g. card back 14 of 14)
```

## What works (measured)

- **Text contrast:** 0 failures across all 12 screens (e.g. add word with errors: 21 of 21 text elements measured, all pass).
- **Tap targets:** none under 44×44px on any screen. The answer buttons are 167×60px, in easy thumb reach (Fitts index 1.33).
- **Names and structure:** 0 unnamed controls. The card back reads in order: heading "reluctant" → "similar words" → "in Persian" (Persian with `lang="fa"`) → "in a sentence" → Not yet / Knew it!
- **Forms:** every field has a real label. Errors are linked with `aria-invalid` + `aria-describedby`, and all errors show at once under their fields.
- **Hidden decoration:** the swipe stamps (KNEW IT! / NOT YET) and the sleeping mascot's "z z z" are correctly hidden from screen readers.
- **Focus ring on cream and white:** passes (3.30:1 and 3.61:1, 3px thick).
- **No console errors, no layout overflow** on any screen, at either size.

## Where to start (impact ÷ effort)

1. ~~**01** focus ring on coloured panels~~ (done, option B).
2. ~~**03** hide "Create an account"~~ (done).
3. ~~**02 follow-up** focus on "Session complete!"~~ (done).
4. ~~**05** "no streak yet"~~ (done).
5. **04** hover lift: with the motion pass.
