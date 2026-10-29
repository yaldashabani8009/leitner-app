# Roadmap

| Step                           | Status                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Requirements (PRD)          | ✅ Done                                                                                                                                                                               |
| 2. Domain & algorithm spec     | ✅ Done                                                                                                                                                                               |
| 3. User flows                  | ✅ Done                                                                                                                                                                               |
| 3b. Screen design (iPhone, v2) | ✅ Done (laptop not yet redrawn)                                                                                                                                                      |
| 4. Visual identity & motion    | 🟡 Style, palette, font, mascot poses done; first mascot motion built in 7.8 (small loops and hops); final motion design still open                                                   |
| 5. Architecture & ADRs         | ✅ Done: [docs/adr](adr/README.md)                                                                                                                                                    |
| 6. Engineering setup           | ✅ Done: repo, tooling, tokens, PWA, CI, DB schema                                                                                                                                    |
| 7. Build the MVP               | 🟡 In progress: 7.1–7.5 and 7.7–7.11 done; 7.6 waits for its phone + laptop test. **Next: 7.12**                                                                                      |
| 8. Deploy & install            | 🟡 Site live at https://yaldashabani8009.github.io/leitner-app/ (auto-deploys). Sign-ups off and own user created. Still to do: reset-link URL in Supabase ([setup](setup/deploy.md)) |
| 9. Use & iterate               | ⬜                                                                                                                                                                                    |

## Step 7 tasks (in order)

Each task = one branch + one pull request. CI must be green before merging.

| #       | Task                                                                         | Definition of Done                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 ✅  | Leitner engine (`answer`, `newCard`, `isDue`)                                | Pure functions, all PRD rules covered by tests, 100% branch coverage                                                                                                                                                        |
| 7.2 ✅  | Time helpers (today in profile TZ, add days)                                 | Tests for TZ edges (midnight, DST) **and device TZ ≠ profile TZ** (e.g. phone on Asia/Tehran, profile on America/New_York and vice versa): "today", due cards and the daily cap must follow the profile TZ, never the phone |
| 7.3 ✅  | Session builder (20 cards, cap 100, order, practice queue)                   | Tests for cap, ordering, practice not counting                                                                                                                                                                              |
| 7.4 ✅  | Dexie schema + repositories (cards, entries, logs, outbox)                   | Tests with fake-indexeddb                                                                                                                                                                                                   |
| 7.5 ✅  | Supabase client + auth screens (sign in, sign up, forgot)                    | Can sign in on iPhone PWA and stay signed in                                                                                                                                                                                |
| 7.6 🟡  | Sync module (push outbox, pull since, LWW)                                   | Merge rules unit-tested ✅; manual two-device test (phone + laptop) moved to 7.10, when words can be added                                                                                                                  |
| 7.7 ✅  | UI kit: Button, Pill, Card, BottomPanel, Sheet, TopBar                       | Matches canvas; tokens only (Stylelint green). Dev-only gallery at `?kit`                                                                                                                                                   |
| 7.8 ✅  | Mascot component (8 poses as SVG parts)                                      | All poses render; reduced-motion respected                                                                                                                                                                                  |
| 7.9 ✅  | Screens: Loading, Review (flip, swipe), Practice, Session complete, All done | Flow matches PRD; swipe off on front                                                                                                                                                                                        |
| 7.10 ✅ | Add / Edit sheet + validation + duplicate rule                               | Errors under fields; duplicate → box 1 tomorrow. Built. **Still to do on the phone after merging (Yali):** the 7.6 phone + laptop sync test, the sheet with the iPhone keyboard open, flip and swipe                        |
| 7.11 ✅ | Streak + words learned                                                       | Words learned from review logs; streak days saved when earned and synced (ADR-015); tested; top-bar pills, Loading streak pill and Session complete bubble on                                                               |
| 7.12    | Export / Import backup                                                       | Round-trip test                                                                                                                                                                                                             |
| 7.13    | Laptop layout + keyboard shortcuts                                           | Space / ← → / E / Esc work                                                                                                                                                                                                  |
| 7.14    | Playwright E2E: review, add word, offline launch                             | Green in CI (WebKit + Chromium)                                                                                                                                                                                             |

## Where we are (end of session 2026-10-29)

**Still to do on the phone (Yali):**

- [ ] 7.6 phone + laptop sync test: add words on the iPhone, check they appear on the laptop; edit one on the laptop, check the phone. Then mark 7.6 ✅.
- [ ] Confirm the add/edit sheet with the real iPhone keyboard (sheet follows the visible area; no autofocus on open).
- [ ] When words are due: try flip, swipe and the practice round.
- [ ] 7.11: after a session that clears all due words, the top-bar flame goes up by one, and the phone and laptop show the same streak after syncing.

**Changes after Yali's iPhone tests (all merged, canvas updated):**

- Buttons: orange / aqua / cream with the ink outline and shadow, no black fills (rules in `docs/design/README.md`).
- Card back: white answer panel; progress bar 48px under the top bar, cards 40px under it.
- Session complete: words under the mascot, streak as the mascot's speech bubble, panel holds only the buttons.
- Buttons on rest screens 48px higher; loading shows 2.5 s; empty box says "Your box is empty".
- Add / Edit: one comma field each for similar words and Persian (`,` or `،`), "+ sentence" under the sentences, drag the handle down to close.

**7.11 done:** words learned and the streak are on (top-bar pills, Loading pill, Session complete bubble). Earned days are saved and synced in the new `streak_days` table (ADR-015). The streak starts counting from 2026-10-29; earlier days have no record.

**Next task: 7.12 Export / Import backup.** The backup must include streak days as well as cards, entries and review logs.
