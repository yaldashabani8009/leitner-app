# Leitner Vocabulary App: PRD & Algorithm Spec

Owner: Yali · Last updated: 2026-10-28
Living copy (original): Claude Doc "Leitner Vocabulary App — PRD & Algorithm Spec". **This file is the source of truth from now on.**

## Overview

A flashcard app for learning English vocabulary with the Leitner method. It's a mobile-first PWA, installable on **iPhone and Android** and usable in a laptop browser, with a cloud database and local-first offline use.

- **Problem:** learning many English words needs a review schedule that shows each word at the right time, on any device.
- **Users:** one person (the owner) now; designed so other users can be opened up later (ADR-010).
- **Feel:** cute and playful: a box mascot reacts to everything, very round chunky UI.
- **Quality bar:** proper software engineering: specs, ADRs, tests, version control, CI.
- **Constraint:** free tools and services only.

## Scope

**In v1**

- Add a word with synonyms, Persian meanings and example sentences
- Edit every field; add more items to each list at any time
- Review sessions: see the word, flip, mark "Knew it!" / "Not yet"
- Leitner scheduling as below, including mastered cards
- Sign in once per device (email + password); sign up and forgot password screens exist, public sign-ups off. While sign-ups are off, the Sign in screen doesn't show "Create an account" (decided 2026-10-29; switch `SIGNUPS_OPEN` in `src/app/features.ts`).
- Sign up takes the time zone quietly from the phone; it can be changed in the profile later (decided 2026-10-28)
- Sync between devices through Supabase
- Fully offline for 30+ days, syncing on reconnect
- Mascot and playful animation
- Backup without a button (decided 2026-10-29, ADR-016): sync is the backup. Only after 14 days without the cloud does a modal offer "Save a copy of your words?" (a JSON file); when the box is empty and the cloud can't be reached, a modal offers to restore from that file.

**Out of v1:** native store apps; sharing decks; showing box numbers, counters or due dates; reviewing mastered cards; deleting cards.

**Future ideas:** review mastered cards every 2 weeks or a quick exam; statistics; native wrapper; open to other users; **Sign out** (left out of v1 on purpose, decided 2026-10-28; there is no settings screen, so its place is still open).

## Card structure

| Field                               | Side  | How many     | Notes                    |
| ----------------------------------- | ----- | ------------ | ------------------------ |
| Word                                | Front | Exactly 1    | English word or phrase   |
| Synonyms ("similar words")          | Back  | ≥ 1 required |                          |
| Persian meanings ("in Persian")     | Back  | ≥ 1 required | Right to left, Vazirmatn |
| Example sentences ("in a sentence") | Back  | ≥ 1 required |                          |

- Editing never changes the box or due date.
- Editing the word into a word another card already has is blocked, with an error under the word field (decided 2026-10-28).
- Capitals and extra spaces don't make a different word ("Happy" = " happy ").
- **Duplicate word:** warn, open the existing card instead, and move it back to box 1, due tomorrow. This applies to mastered cards too: they are un-mastered and reviewed again (decided 2026-10-28).
  - The app asks first (decided 2026-10-29): "Open my card" moves the card back and shows it to read (card back with the pencil, and "Done"); "Cancel" changes nothing and keeps what you typed.
- Similar words and Persian meanings are typed in **one field each, separated by a comma** (`,` or the Persian `،`); empty pieces and repeats are dropped. Add or remove an item by typing (decided 2026-10-29, after Yali's iPhone test).
- Sentences are never split (they contain commas): one field per sentence, "+ sentence" right under them, and in Edit a ✕ next to each sentence while there is more than one (decided 2026-10-29).
- Validation: Save is never disabled; the error appears under the empty field.

## Leitner algorithm

| Box      | Next review after a right answer moves the card here |
| -------- | ---------------------------------------------------- |
| 1        | 1 day                                                |
| 2        | 2 days                                               |
| 3        | 4 days                                               |
| 4        | 8 days                                               |
| 5        | 16 days                                              |
| Mastered | Not reviewed in v1 (`mastered_at` saved)             |

1. New card → box 1, due tomorrow.
2. Right answer → up one box; due = today + that box's gap.
3. Right answer in box 5 → mastered.
4. Wrong answer → box 1, due tomorrow (from any box).
5. Missed days: nothing moves by itself; a due card stays due.
6. Box number, counter and due date are never shown in the UI.
7. Gaps live in one config value (`src/domain/leitner/config.ts`).

## Sessions

1. Up to **20** due cards per session; opening again the same day gives the next 20.
2. **Daily cap: 100** scheduled reviews (practice repeats don't count).
3. At the cap → "All done for today"; leftovers roll over.
4. Order: most overdue first, then lowest box. Cards with the same due date and box are shuffled, with the same order all day (decided 2026-10-28).
5. Wrong answer → rescheduled (box 1, tomorrow) **and** repeated once at the end as practice.
6. Practice answers change nothing.
7. Leaving mid-session: unanswered cards stay due.

## Streak and progress (top bar)

- Two floating pills (words learned, streak) + a round + button.
- **Streak:** a day counts when any one is true (decided 2026-10-28):
  1. 20 scheduled reviews were done that day, across any number of sessions (practice doesn't count);
  2. fewer than 20 cards were due, and all of them were reviewed;
  3. no cards were due at all, and a new word was added. The All done screen nudges you to add a word to keep the streak.
  - The day is saved the moment it counts and never removed (ADR-015). Until today counts, the streak shows the run up to yesterday; a whole missed day resets it (decided 2026-10-29).
  - The streak pill on Loading and the bubble on Session complete are hidden while the streak is 0; the top-bar pill always shows.
- **Words learned:** cards that have passed box 1 at least once, i.e. a scheduled "Knew it!" in box 1 (never goes down, even when the card goes back to box 1).
- Session progress: chunky pill bar, no numbers.

## Daily reminder (decided 2026-10-29, ADR-018)

- Once a day from **19:00** in the profile's time zone, only when there is something to do:
  - words due → "Time for your words · 12 words are waiting for you."
  - nothing due and today not yet counted → "Keep your streak going · Add a word to keep your 5-day streak." (or "Add a new word today and start a streak.")
  - today already counts, or the daily cap is reached → no notification.
- The app icon shows the number of words still waiting today (installed app; on iPhone once notifications are allowed).
- Offered once per device after a session ("I'm done for now" on Session complete): "Want a daily reminder?" Yes → the phone asks for permission → a test notification "Reminders are on". Not now → asked again in 7 days. Turned off in the phone's settings.
- iPhone: only in the app added to the Home Screen (iOS 16.4+). Android: Chrome.

## User flow

1. Open app. First launch on a device → Sign in (Sign up only once sign-ups are open).
2. Loading (2.5 s, cold start; decided 2026-10-29): waving mascot + "{display_name}'s Leitner." (no name → "Leitner.") + streak pill.
3. Cards due and under cap → review card. Otherwise → "All done for today" (sleeping mascot, Add a new word). An empty box says "Your box is empty" with "Add your first word to start learning." (decided 2026-10-29).
4. Card front (word) → tap → back (similar words, in Persian, in a sentence, pencil to edit).
5. Answer: swipe right = Knew it, left = Not yet, or tap buttons. No swiping on the front.
6. After 20: practice round for misses → "Session complete" (celebrating mascot; streak counts). "Next N words" shows only when more are due and under the cap. "I'm done for now" while more are due → a calm resting screen ("Nice work! More words are waiting whenever you're ready." + "Keep going"); otherwise → All done (decided 2026-10-28).
7. Add word: bottom sheet (top bar + or All done). Save checks required fields and duplicates. The sheet is only as tall as its fields and sits above the phone keyboard; fields grow with the text. Drag the handle down (or tap ✕) to close it.
8. Edit: pencil on card back → same sheet, pre-filled, with the reminder "Editing won't change when you see this word next."

Laptop (built in 7.13): Space flips, ← / → answer, E edits (card back only), Esc closes; centred 560px column on screens 700px and wider; add/edit is a centred modal. With a mouse or trackpad the card says "click or press space" instead of "tap to flip". Shortcuts never fire while typing, while a sheet or dialog is open, or with Ctrl / ⌘ / Alt held.

## Time and offline

- Timestamps in UTC; "today" = now in the profile time zone; due dates are calendar dates in that zone.
- The phone's own time-zone setting never decides "today"; only the profile time zone does. Must work for any IANA time zone. (Owner tests by setting the phone to a different zone, currently Asia/Tehran.)
- If the profile time zone is missing or not a real zone, the app uses UTC (the database default), never the phone's zone (decided 2026-10-28).
- Daily cap resets at local midnight (profile time zone).
- Service worker caches the whole app after the first online launch.
- Sign-in kept permanently; an expired session never blocks local cards.
- Request persistent storage on first launch.
- Sync: last edit wins by `updated_at`; review logs append-only.
- Sanctioned countries (e.g. Iran): Supabase/US hosts may be unreachable. Install and sign in beforehand, export backups, sync after returning.

## Data model

See `supabase/migrations/` (source of truth) and ADR-003. Tables: `profiles` (display_name, time_zone), `cards`, `card_entries`, `review_logs`, `streak_days` (ADR-015), `push_subscriptions` and `app_config` (ADR-018).

## Open questions

- [x] Keep "Think first… then tap the card" on the front: yes (Yali, 2026-10-28). "That's okay. You'll see it again tomorrow." shows while swiping left / after "Not yet", as on the canvas (not in the practice round, where nothing is rescheduled).
- [x] Session complete: no score (Yali, 2026-10-28): "You went through 20 words. Nice work."
- [x] Sign-in / sign-up / forgot-password screens: designed in code in the v2 style, reviewed by Yali from screenshots (2026-10-28). Mascot added in 7.8.
- [x] Where Export/Import lives: nowhere in the app; it appears as a modal only when needed (Yali, 2026-10-29, ADR-016).
- [x] Laptop screens redrawn in v2 style: the phone screens in a centred column (7.13, canvas "Laptop" row).
- [x] Motion: final version built in roadmap step 4 (2026-10-29), spec in `docs/design/motion.md`; every value is a token, easy to tune.
