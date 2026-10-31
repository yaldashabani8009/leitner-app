# Roadmap

| Step                           | Status                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1. Requirements (PRD)          | ✅ Done                                                                                                                             |
| 2. Domain & algorithm spec     | ✅ Done                                                                                                                             |
| 3. User flows                  | ✅ Done                                                                                                                             |
| 3b. Screen design (iPhone, v2) | ✅ Done (laptop added in 7.13)                                                                                                      |
| 4. Visual identity & motion    | ✅ Done: style, palette, font, mascot poses; final motion built 2026-10-29 ([motion.md](design/motion.md))                          |
| 5. Architecture & ADRs         | ✅ Done: [docs/adr](adr/README.md)                                                                                                  |
| 6. Engineering setup           | ✅ Done: repo, tooling, tokens, PWA, CI, DB schema                                                                                  |
| 7. Build the MVP               | 🟡 In progress: all built (7.1–7.5, 7.7–7.14); 7.6 waits for its phone + laptop test                                                |
| 8. Deploy & install            | ✅ Done: site live, auto-deploys after all tests, live smoke check after every deploy; sign-ups off; reset-link URL set in Supabase |
| 9. Use & iterate               | 🟡 Ongoing: maintenance + audit done, audit fixes built; next comes from Yali's daily use                                           |
| 10. Daily reminder (v1.1)      | 🟡 Built (ADR-018): 19:00 notification + app-icon number; waits for Yali's phone test                                               |

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
| 7.12 ✅ | Backup reminder + restore (modals only, ADR-016)                             | Round-trip test ✅; "Save a copy?" after 14 days without the cloud; restore when the box is empty and the cloud is unreachable                                                                                              |
| 7.13 ✅ | Laptop layout + keyboard shortcuts                                           | Space / ← → / E / Esc work ✅ (tested); centred 560px column and centred add/edit modal from 700px wide                                                                                                                     |
| 7.14 ✅ | Playwright E2E: review, add word, offline launch                             | Green in CI (WebKit + Chromium) ✅; the deploy waits for it (ADR-017)                                                                                                                                                       |

## Where we are (end of session 2026-10-29)

**Still to do on the phone (Yali):**

- [ ] 7.6 phone + laptop sync test: add words on the iPhone, check they appear on the laptop; edit one on the laptop, check the phone. Then mark 7.6 ✅.
- [ ] Confirm the add/edit sheet with the real iPhone keyboard (sheet follows the visible area; no autofocus on open).
- [ ] When words are due: try flip, swipe and the practice round.
- [ ] 7.11: after a session that clears all due words, the top-bar flame goes up by one, and the phone and laptop show the same streak after syncing.
- [ ] 7.13: on the laptop, review a few words with Space and the arrow keys, and press E on a card back.
- [ ] 7.14: once, open the installed app on the iPhone in flight mode: it should open on your box (the automatic test can't do this part in Safari's engine).
- [ ] 8: tap **Forgot password?**, open the email on the phone, set a new password: you should land back in the app, signed in.
- [ ] 10: finish a session, tap **I'm done for now**, answer **Yes, remind me** and allow notifications: a "Reminders are on" notification arrives, and the app icon shows the number of words waiting. At 19:00 the next day (if words are waiting or the streak needs a word) the reminder arrives.

**Changes after Yali's iPhone tests (all merged, canvas updated):**

- Buttons: orange / aqua / cream with the ink outline and shadow, no black fills (rules in `docs/design/README.md`).
- Card back: white answer panel; progress bar 48px under the top bar, cards 40px under it.
- Session complete: words under the mascot, streak as the mascot's speech bubble, panel holds only the buttons. With nothing else due, the panel holds one aqua "Done for today" button (2026-10-29).
- Buttons on rest screens 48px higher; loading shows 2.5 s; empty box says "Your box is empty".
- Add / Edit: one comma field each for similar words and Persian (`,` or `،`), "+ sentence" under the sentences, drag the handle down to close.

**7.11 done:** words learned and the streak are on (top-bar pills, Loading pill, Session complete bubble). Earned days are saved and synced in the new `streak_days` table (ADR-015). The streak starts counting from 2026-10-29; earlier days have no record.

**7.12 done:** no backup button anywhere. A "Save a copy of your words?" modal appears only after 14 days without the cloud (with changes waiting), and "Have a backup file?" only when the box is empty and the cloud can't be reached (ADR-016).

**7.13 done:** on a laptop the app sits in a centred 560px column, add/edit is a centred modal, and Space / ← → / E / Esc work. Phones are unchanged.

**7.14 done:** end-to-end tests run the built app in WebKit (iPhone Safari) and Chromium (Android) on every PR and before every deploy: sign in, add words, review the next day (tap, keyboard, practice, Session complete), duplicate word, and opening offline. The cloud is an in-memory stand-in, so no secrets are needed (ADR-017).

**Next:** finish the phone checks above (then mark 7.6 ✅), and step 8: add the reset-link URL in Supabase ([setup](setup/deploy.md)).

## Step 9: use & iterate

Yali uses the app daily and notes what feels wrong, slow or missing; each note becomes a small task with options.

**Backlog** — from the [UX/UI audit of 2026-10-29](audits/2026-10-29-ux-ui-audit.md):

- [x] 01 Focus ring invisible on orange / aqua panels: **B** chosen (Yali, 2026-10-29) and built: ink ring on orange (7.19:1) and aqua (12.27:1), terracotta elsewhere.
- [x] 03 "Create an account" hidden while sign-ups are closed (Yali, 2026-10-29): one switch, `SIGNUPS_OPEN` in `src/app/features.ts`, flipped together with the Supabase setting.
- [x] 02b After the last keyboard answer, focus moves to "Session complete!".
- [x] 05 Screen readers say "no streak yet" instead of "0-day streak".
- [x] 04 Hover on laptops: buttons rise 2px and their shadow grows (built in step 4).

Done in step 9: GitHub Actions updated (Node 24) and runners pinned to Ubuntu 24.04; keyboard focus kept after answering a card (audit 02).

## Step 11: v3 — decks, Today screen, all words, extra practice

Build brief: `HANDOFF-v3-build.md` (Yali and Claude, 2026-10-31). Decisions in it are final; anything not covered is noted in the PR under "Decided without asking". One branch and PR per task.

| #        | Task                                                                                | Definition of Done                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11.1 ✅  | Deck registry + config + engine per deck                                            | `src/domain/decks` registry; per-deck limits in config; session picking, daily limit and streak work per deck and across decks; 100% coverage; ADR-019 |
| 11.2 ✅  | Data: migration, Dexie v4, sync, backup v2                                          | Migration applied through the MCP, advisors clean, types regenerated; upgrade tested with fake-indexeddb; v1 and v2 backups both restore               |
| 11.3 ✅  | Quick fixes: single loading screen, badge = all cards, badge opens all words (stub) | Cold start shows one screen with the name; badge counts every deck; tests                                                                              |
| 11.4 ✅  | Add sheet stays open + toast + per-deck duplicate flow + + roll-out                 | Works with 1 or 3 enabled decks; old S11 dialog removed; e2e "add 3 words in a row" passes                                                             |
| 11.5 ✅  | Today screen with the deck wheel + DJ mascot pose                                   | All four card states; Home button inside sessions; pause and resume; the practice round survives a switch; screenshots                                 |
| 11.6 ✅  | Mix them all                                                                        | Random 3–9 chunks, no interstitial, real answers move boxes, per-deck limits, extra practice when nothing is due; tests with seeded randomness         |
| 11.7 ✅  | Extra practice                                                                      | `added_on` logic; never moves boxes; no streak or limits; repeat-missed loop                                                                           |
| 11.8 ✅  | All-words page                                                                      | Chips, Persian search, 3 sorts, dots, swipe-delete + Undo, virtualised, offline; laptop layout                                                         |
| 11.9 ✅  | Settings sheet + reminder time + next-reminder index (ADR-020)                      | Time saved to the profile; cron reads only due rows; switch off = no pushes; sign out works; function redeployed                                       |
| 11.10 ✅ | Laptop shortcuts N / H / / + accessibility pass                                     | Tests for the keys; axe or manual checks noted in the PR                                                                                               |
| 11.11 ✅ | Docs: PRD, design README, canvas notes, roadmap                                     | PRD describes decks, Today, Mix them all, extra practice and all words; "never show box numbers" exception noted                                       |

**Step 11 done (2026-10-31):** decks (only Vocab switched on), the Today screen with the deck wheel and the DJ, Mix them all, pause and resume, extra practice, the add sheet that stays open, the all-words page, Settings with the reminder time and Sign out, laptop keys N / H / /. PRs #29–#39 (and fix #32), each matched to its canvas board. Next: the steps 4–6 brief (`HANDOFF-v3-steps4-6.md`, roadmap step 12).

**Still to do on the phone (Yali), after step 11 is merged:**

- [ ] Add 3 words in a row.
- [ ] Duplicate → Save & start over.
- [ ] Today → Mix them all → Home → Continue.
- [ ] Extra practice.
- [ ] All words: search in Persian, delete + Undo.
- [ ] Set the reminder time.
- [ ] 12.5: in a spelling session on the iPhone (Home Screen app), tap Start once; each next word should play by itself after Check, the retype or a swipe. Then mark 12.5 ✅.
- [ ] 12.7: Mix them all with Vocab and Spelling due on the iPhone: when a spelling chunk starts, the word plays and the keyboard opens straight from your swipe or tap; when a Vocab chunk comes back, the keyboard closes.

## Step 12: v3 — translations, spelling, phrases

Build brief: `HANDOFF-v3-steps4-6.md` (Yali and Claude, 2026-10-31); canvas row "v3 · Steps 4–6" (boards P1–P11). Decisions in it are final; anything not covered is noted in the PR under "Decided without asking". One branch and PR per task.

| #       | Task                                                                                              | Definition of Done                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12.1 ✅ | Translations data: migration, sync, backup v3                                                     | Migration applied through the MCP, advisors clean, types regenerated; v1, v2 and v3 backups restore                                                                                                                                |
| 12.2 ✅ | Translations UI: Persian field under each sentence, hidden-until-tap on the back, search (P1, P2) | Pair add/remove; resets per card; never flips or grades; keyboard toggle; search finds translations; screenshots                                                                                                                   |
| 12.3 ✅ | Spelling domain: split + tidy-up, answer normaliser, diff, sound-alike list                       | Pure functions in `src/domain/spelling`, 100% coverage, table-driven tests                                                                                                                                                         |
| 12.4 ✅ | Spelling add sheet + check step (P3, P4)                                                          | Chips plain / greyed / dashed; edit and remove; "Save N words"; toast "N saved"; sheet stays open; e2e "paste 10 words"                                                                                                            |
| 12.5 🟡 | Speech service + sound unlock (ADR-021)                                                           | Voice choice, normal and slow; speak from handlers only; pulse fallback; tested on Yali's iPhone (Home Screen app) Built and unit-tested with a fake voice ✅; **the real-iPhone check is Yali's** (see the phone list)            |
| 12.6 ✅ | Spelling study (P5–P7) + practice + extra practice; enable the deck                               | Correct / wrong / show me / sound-alike flows; `typed_answer` logged; retype to go on; laptop works; screenshots ✅ (the answer field stays put from card to card so the iPhone keyboard stays open; e2e: paste 10 words)          |
| 12.7 ✅ | Mix them all with spelling chunks                                                                 | Keyboard switches with the chunk; 3–9 chunks; no same-deck chunks back to back; seeded-random tests ✅ (the answer is committed inside the swipe, so iPhone allows the word and the keyboard; chunks never leave 1–2 cards behind) |
| 12.8    | Soft boxes: per-deck miss rule (ADR-022)                                                          | `stepBack` never goes below box 1; vocab and spelling unchanged; 100% coverage                                                                                                                                                     |
| 12.9    | Phrases add + study + session-complete line (P8–P11); enable the deck                             | All back states (both, one, none); Got it / Show me sooner; "no meaning yet" run; screenshots                                                                                                                                      |
| 12.10   | Docs: PRD, design README, canvas notes, roadmap                                                   | PRD covers translations, spelling and phrases; future list updated                                                                                                                                                                 |

**Future list (not built):**

- Wrong-field hint in the add sheet: Persian letters in an English field (or the reverse) shows "Looks like Persian, move it to the Persian field?" with a one-tap fix.
- A natural paid cloud voice for spelling.
- Meaning → phrase practice.
- A "where I saw it" note on phrases.
