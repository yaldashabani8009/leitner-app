# Leitner Vocabulary App: PRD & Algorithm Spec

Owner: Yali · Last updated: 2026-10-31 (v3: decks, Today, Mix them all, extra practice, all words, settings)
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

**Out of v1:** native store apps; sharing decks; showing box numbers, counters or due dates (v3 exception: the progress dots on the all-words page); reviewing mastered cards.

**Since v3 (2026-10-31):** decks, the Today screen, Mix them all, extra practice, the all-words page with delete + Undo, Settings with a reminder time and Sign out. See the sections below.

**Future ideas:** review mastered cards every 2 weeks or a quick exam; statistics; native wrapper; open to other users; daily limits per deck in Settings; grammar as another deck (the deck registry is ready for it).

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
- **Duplicate word (v3, canvas N5):** one card per word **per deck**; the same word in another deck is not a duplicate. Typing a word that is already in the deck shows a soft note "Already in your Vocab box" under the word field (when you leave it, or on Save); the form fills with the existing card and keeps what you typed. Save becomes **Save & start over**: the card is updated, goes back to box 1 (due tomorrow; mastered cards are un-mastered) and counts as added today. "Add another word" empties the form; ✕ changes nothing. No popup (the v2 "Open my card" dialog is retired).
- **Adding stays open (canvas N4):** after Save the fields clear, the cursor goes back to the word field and a toast says "meticulous saved" (about 2 s). The sheet closes only with ✕, Esc or a drag down; a chip next to "New word" shows the deck.
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
6. Box number, counter and due date are never shown in the UI. The one exception (v3): the progress dots on the all-words page (5 dots filled up to the box, a star when mastered; spoken "Box 3 of 5" / "Mastered").
7. Gaps live in one config value (`src/domain/leitner/config.ts`).

## Sessions

1. Each deck has its own session size and daily limit (v3; `DECK_LIMITS` in config): vocab 20 / 100, spelling 30 / 250, phrases 10 / 30. Opening again the same day gives the next cards.
2. The **daily limit** counts that deck's scheduled reviews (practice repeats don't count).
3. At the cap → "All done for today"; leftovers roll over.
4. Order: most overdue first, then lowest box. Cards with the same due date and box are shuffled, with the same order all day (decided 2026-10-28).
5. Wrong answer → rescheduled (box 1, tomorrow) **and** repeated once at the end as practice.
6. Practice answers change nothing.
7. Leaving mid-session: unanswered cards stay due. **Home** (top left in a session) leaves without asking; the deck then says "Paused · N left" and continues where it stopped. Only the session's card list is saved (per deck per day, on the device); where you were and the practice round are worked out from the review logs, so they survive switching decks or closing the app.

## Streak and progress (top bar)

- Two floating pills (the box badge, the streak) + a round + button; on Today a settings button sits top left, in a session a Home button.
- **Box badge (v3):** every card in every deck (not deleted; mastered ones included), a box icon, spoken "312 cards in your box". Tapping it opens the all-words page. It replaces "words learned".
- **Streak (shared across decks):** a day counts when any one is true (decided 2026-10-28; v3 counts all decks together):
  1. 20 scheduled reviews were done that day in total, across sessions and decks (practice doesn't count);
  2. every card due that day, in all decks, was reviewed;
  3. no cards were due at all, and a new card was added.
  - The day is saved the moment it counts and never removed (ADR-015). Until today counts, the streak shows the run up to yesterday; a whole missed day resets it (decided 2026-10-29).
  - The streak pill on Loading and the bubble on Session complete are hidden while the streak is 0; the top-bar pill always shows.
- **Words learned** (still worked out in the code, no longer shown): cards that have passed box 1 at least once.
- Session progress: chunky pill bar, no numbers.

## Daily reminder (decided 2026-10-29, ADR-018; time per user since v3, ADR-020)

- Once a day at **the user's time** (Settings, 15-minute steps, default 19:00) in the profile's time zone, only when there is something to do:
  - cards due (counted across all decks, each within its daily limit) → "Time for your words · 20 cards waiting · mostly spelling" (the deck is named only when more than one is enabled)
  - nothing due and today not yet counted → "Keep your streak going · Add a word to keep your 5-day streak." (or "Add a new word today and start a streak.")
  - today already counts, or the daily cap is reached → no notification.
- The app icon shows the number of cards still waiting today across all decks (installed app; on iPhone once notifications are allowed).
- Switched on or off in Settings; turning it on from a phone that never allowed notifications asks for permission. A reminder more than 4 hours late (the server was paused) waits for tomorrow.
- Offered once per device after a session ("I'm done for now" on Session complete): "Want a daily reminder?" Yes → the phone asks for permission → a test notification "Reminders are on". Not now → asked again in 7 days. Turned off in the phone's settings.
- iPhone: only in the app added to the Home Screen (iOS 16.4+). Android: Chrome.

## User flow

1. Open app. First launch on a device → Sign in (Sign up only once sign-ups are open).
2. Loading (2.5 s, cold start): waving mascot + "{display_name}'s Leitner." + streak pill. Until the saved profile is read, only the cream page shows, so there is one Loading screen, already with the name (v3); "Leitner." alone only when the account has no name.
3. **Today** (v3, canvas N1): choose a deck card, or **Mix them all** (see below).
4. Card front (word) → tap → back (similar words, in Persian, in a sentence, pencil to edit).
5. Answer: swipe right = Knew it, left = Not yet, or tap buttons. No swiping on the front.
6. After the session: practice round for misses, then "Session complete" (celebrating mascot; streak counts). "Next N words" shows only when more are due in that deck (or any deck, in Mix them all); "I'm done for now" / "Done for today" go back to Today.
7. Add word: the + rolls out one button per enabled deck (canvas N2; with one deck it opens that deck's sheet straight away). Same on Today, in sessions and on all words. The sheet stays open after Save (see Card structure). It sits above the phone keyboard; fields grow with the text.
8. Edit: pencil on card back → same sheet, pre-filled, with the reminder "Editing won't change when you see this word next."

Laptop (built in 7.13; v3 keys in 11.10): Space flips, ← / → answer, E edits (card back only), Esc closes, **N** opens the +, **H** goes Home, **/** focuses search on all words; centred 560px column on screens 700px and wider; add/edit is a centred modal. With a mouse or trackpad the card says "click or press space" instead of "tap to flip". Shortcuts never fire while typing, while a sheet or dialog is open, or with Ctrl / ⌘ / Alt held.

## Decks (v3, ADR-019)

- One `cards` table with a `deck`: `vocab | spelling | phrases`; old cards are vocab. Decks come from a registry (`src/domain/decks`), each with a label, icon, colours, limits and `enabled`. **Only Vocab is enabled** until the spelling (step 5) and phrases (step 6) cards are designed; every screen works with any number of enabled decks.
- The Leitner engine (boxes, gaps, "Not yet" to box 1) is the same for every deck.
- Each card stores `added_on`: the day it was added, or re-added with "Save & start over" (profile time zone).

## Today (v3, canvas N1, N3)

- Top bar: settings (top left), box badge, streak, +. "Hi Yali!" and "What shall we study today?". The DJ mascot (the only playful element: no confetti on Today) with **Mix them all** and "27 cards from all decks" (or "Paused · N left" while a mix is paused).
- One card per enabled deck hangs from a wheel on the left (top −9°, middle 0°, bottom +9°); drag up or down to spin it. Each card has one status line: **Paused · 7 left** (play: continue), **20 waiting** (play: start), **All done for today** (✓: a small sheet with "Practice today's new words" when words were added today, and "Add …"), **Empty** (opens the deck's add sheet).

## Mix them all (v3, canvas N6)

- With cards due in any deck: the real sessions of every such deck in one stream, in random chunks of 3–9 cards from one deck (a deck with only 1–2 cards due gives just those; a deck never leaves 1–2 behind for a tiny last chunk), each chunk shuffled; no pause between chunks; two chunks from the same deck only come back to back when no other deck has cards left. Spelling cards are included: the swipe or tap that ends the card before a spelling chunk says the first word and opens the keyboard; a Vocab chunk closes it again. The deck chip next to the progress bar shows which deck a card is from. Each deck's session size and daily limit apply; answers move boxes; the practice round comes at the end. Home and Mix them all again carry on where it stopped.
- With nothing due anywhere: extra practice of today's new words from all decks.

## Extra practice (v3, canvas N11, N12)

- The cards added on a day, each once, shuffled again every time; mixed decks come in chunks of 3–9. Ways in: a finished deck ("Practice today's new words"); Mix them all with nothing due; a day heading's **Practice** on the all-words page.
- Never moves a card, never counts toward daily limits or the streak (logged as practice).
- Calm look: a white banner "Practice · your boxes stay the same" with the count, the tag "today's new words", one quiet line "Just for fun: answers here never move your cards", no coloured panel, no confetti.
- End: "Practice done! You missed 4. Want one more go at just those?" with **Practice the 4 again** / **Done**, repeating with the smaller list until nothing is missed ("You knew every one.").

## All words (v3, canvas N8–N10, L4)

- Opens from the box badge: back, "In your box" with the total, +. Deck chips (All + each enabled deck, with counts) scroll sideways; on a laptop they wrap.
- Search matches the word and its Persian meanings as you type (ي = ی, ك = ک, the half-space ignored). Sorts: **By day** (newest first, under TODAY / YESTERDAY / 14 SEP headings, each with Practice), **A–Z**, **Needs work** (most real "Not yet" answers first, ties by lowest box).
- Rows: no boxes, a thin divider; the deck icon on the All view only; the word and its Persian; progress dots (the only place box progress shows). Tap: the card with Edit. Swipe left: red Delete; tap it to delete (soft delete, synced); a toast "reluctant deleted" with **Undo** for about 5 s.
- Virtualised (smooth with thousands of words), reads only the device (works offline). Empty: the mascot and "Your box is empty".

## Settings (v3, canvas N13)

- From the button top left on Today: **Daily reminder** on/off, **Remind me at** (15-minute steps, default 19:00), "Signed in as Yali" and **Sign out** (this device only; works offline). No time-zone setting: it follows the profile.

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

See `supabase/migrations/` (source of truth) and ADR-003. Tables: `profiles` (display_name, time_zone, reminder_time, reminders_on), `cards` (with `deck` and `added_on`, ADR-019), `card_entries`, `review_logs` (with `typed_answer` for spelling, unused until step 5), `streak_days` (ADR-015), `push_subscriptions` (with `next_reminder_at`, ADR-020) and `app_config` (ADR-018). On the device: Dexie version 4; backups are version 2 and version-1 files still restore.

## Open questions

- [x] Keep "Think first… then tap the card" on the front: yes (Yali, 2026-10-28). "That's okay. You'll see it again tomorrow." shows while swiping left / after "Not yet", as on the canvas (not in the practice round, where nothing is rescheduled).
- [x] Session complete: no score (Yali, 2026-10-28): "You went through 20 words. Nice work."
- [x] Sign-in / sign-up / forgot-password screens: designed in code in the v2 style, reviewed by Yali from screenshots (2026-10-28). Mascot added in 7.8.
- [x] Where Export/Import lives: nowhere in the app; it appears as a modal only when needed (Yali, 2026-10-29, ADR-016).
- [x] Laptop screens redrawn in v2 style: the phone screens in a centred column (7.13, canvas "Laptop" row).
- [x] Motion: final version built in roadmap step 4 (2026-10-29), spec in `docs/design/motion.md`; every value is a token, easy to tune.
