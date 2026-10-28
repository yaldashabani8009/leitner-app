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
- Sign in once per device (email + password); sign up and forgot password screens exist, public sign-ups off
- Sync between devices through Supabase
- Fully offline for 30+ days, syncing on reconnect
- Mascot and playful animation
- Export / Import backup (JSON)

**Out of v1:** native store apps; sharing decks; showing box numbers, counters or due dates; reviewing mastered cards; deleting cards.

**Future ideas:** review mastered cards every 2 weeks or a quick exam; statistics; native wrapper; open to other users.

## Card structure

| Field                               | Side  | How many     | Notes                    |
| ----------------------------------- | ----- | ------------ | ------------------------ |
| Word                                | Front | Exactly 1    | English word or phrase   |
| Synonyms ("similar words")          | Back  | ≥ 1 required |                          |
| Persian meanings ("in Persian")     | Back  | ≥ 1 required | Right to left, Vazirmatn |
| Example sentences ("in a sentence") | Back  | ≥ 1 required |                          |

- Editing never changes the box or due date.
- **Duplicate word:** warn, open the existing card instead, and move it back to box 1, due tomorrow.
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
4. Order: most overdue first, then lowest box.
5. Wrong answer → rescheduled (box 1, tomorrow) **and** repeated once at the end as practice.
6. Practice answers change nothing.
7. Leaving mid-session: unanswered cards stay due.

## Streak and progress (top bar)

- Two floating pills (words learned, streak) + a round + button.
- **Streak:** a day counts when at least one full session of 20 is finished.
- **Words learned:** cards that have passed box 1 at least once (never goes down).
- Session progress: chunky pill bar, no numbers.

## User flow

1. Open app. First launch on a device → Sign in (or Sign up).
2. Loading (~1s, cold start): waving mascot + "{display_name}'s Leitner." (no name → "Leitner.") + streak pill.
3. Cards due and under cap → review card. Otherwise → "All done for today" (sleeping mascot, Add a new word).
4. Card front (word) → tap → back (similar words, in Persian, in a sentence, pencil to edit).
5. Answer: swipe right = Knew it, left = Not yet, or tap buttons. No swiping on the front.
6. After 20: practice round for misses → "Session complete" (celebrating mascot; streak counts).
7. Add word: bottom sheet (top bar + or All done). Save checks required fields and duplicates.
8. Edit: pencil on card back → same sheet, pre-filled.

Laptop: Space flips, ← / → answer, E edits, Esc closes; centred 560px column; add/edit is a centred modal.

## Time and offline

- Timestamps in UTC; "today" = now in the profile time zone; due dates are calendar dates in that zone.
- The phone's own time-zone setting never decides "today"; only the profile time zone does. Must work for any IANA time zone. (Owner tests by setting the phone to a different zone, currently Asia/Tehran.)
- Daily cap resets at local midnight (profile time zone).
- Service worker caches the whole app after the first online launch.
- Sign-in kept permanently; an expired session never blocks local cards.
- Request persistent storage on first launch.
- Sync: last edit wins by `updated_at`; review logs append-only.
- Sanctioned countries (e.g. Iran): Supabase/US hosts may be unreachable. Install and sign in beforehand, export backups, sync after returning.

## Data model

See `supabase/migrations/` (source of truth) and ADR-003. Tables: `profiles` (display_name, time_zone), `cards`, `card_entries`, `review_logs`.

## Open questions

- [ ] Keep "Think first… then tap the card" (front) and "That's okay. You'll see it again tomorrow." (swipe left)?
- [ ] Session complete: show a score ("17 of 20") or not?
- [ ] Sign-in / sign-up / forgot-password screens need drawing in the v2 style.
- [ ] Where Export/Import lives (small settings screen or top-bar menu).
- [ ] Laptop screens redrawn in v2 style.
- [ ] Motion for the new mascot.
