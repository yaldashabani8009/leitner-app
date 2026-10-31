/**
 * The daily reminder (ADR-018, ADR-020): one notification a day at the user's time in the
 * profile time zone, only when there is something to do. Cards are counted across all decks.
 * Pure: shared by the server functions that send it (supabase/functions) and tested here.
 */

import { deckById, type Deck } from '../decks/decks';
import { REMINDER_LATE_LIMIT_HOURS, type DeckId } from '../leitner/config';
import { waitingInDeck } from '../session/pick';

/** One deck's numbers for today. */
export interface DeckDay {
  readonly deck: DeckId;
  /** Cards due today (mastered and deleted cards excluded). */
  readonly due: number;
  /** Scheduled reviews of this deck already done today (practice doesn't count). */
  readonly reviewsToday: number;
}

export interface ReminderFacts {
  /** The enabled decks' numbers. */
  decks: readonly DeckDay[];
  /** Today already counts for the streak. */
  earnedToday: boolean;
  /** Days in a row up to yesterday (today isn't earned yet when a reminder is sent). */
  streak: number;
}

/**
 * Cards still to review today across all decks: each deck's due cards, within its daily limit.
 * The number on the app icon, and the "20 cards waiting" in the reminder.
 */
export function waitingAcrossDecks(decks: readonly DeckDay[]): number {
  return decks.reduce((sum, day) => sum + waitingInDeck(day.due, day.reviewsToday, day.deck), 0);
}

export interface ReminderMessage {
  title: string;
  body: string;
  /** The number on the app icon: cards still waiting today (0 clears it). */
  badge: number;
}

/**
 * What the reminder says, or null for no reminder (the day is already done, or every deck's
 * daily limit is reached). Cards waiting come first, "20 cards waiting · mostly spelling" (the
 * deck is named only when more than one is enabled); otherwise a nudge to add a card, because
 * that keeps the streak on a day with nothing due (PRD streak rule 3).
 */
export function reminderMessage(
  facts: ReminderFacts,
  registry?: readonly Deck[],
): ReminderMessage | null {
  if (facts.earnedToday) return null;
  const waiting = waitingAcrossDecks(facts.decks);
  if (waiting > 0) {
    let body = waiting === 1 ? '1 card waiting' : `${waiting} cards waiting`;
    if (facts.decks.length > 1) {
      const most = [...facts.decks].sort(
        (a, b) =>
          waitingInDeck(b.due, b.reviewsToday, b.deck) -
          waitingInDeck(a.due, a.reviewsToday, a.deck),
      )[0];
      body += ` · mostly ${deckById(most.deck, registry).label.toLowerCase()}`;
    }
    return { title: 'Time for your words', body, badge: waiting };
  }
  if (facts.decks.some((day) => day.due > 0)) return null; // every daily limit is reached; rest
  return {
    title: 'Keep your streak going',
    body:
      facts.streak > 0
        ? `Add a word to keep your ${facts.streak}-day streak.`
        : 'Add a new word today and start a streak.',
    badge: 0,
  };
}

/**
 * Should a reminder due at `scheduledAt` still go out at `now`? Not when the server missed it
 * by hours (it was paused): then it waits for tomorrow instead of arriving late at night.
 */
export function isStillTimely(scheduledAt: string, now: string): boolean {
  return Date.parse(now) - Date.parse(scheduledAt) <= REMINDER_LATE_LIMIT_HOURS * 60 * 60 * 1000;
}

/** "19:00" ↔ minutes since midnight, for the 15-minute time picker. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Rounds to the picker's 15-minute steps: "19:07" → "19:00", "19:08" → "19:15". */
export function roundToStep(time: string, stepMinutes: number): string {
  const total = Math.round(minutesOf(time) / stepMinutes) * stepMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Sent once, right after reminders are turned on, so you know they work. */
export const TEST_MESSAGE = {
  title: 'Reminders are on',
  body: "I'll let you know at your reminder time when cards are waiting, or when your streak needs a new word.",
} as const;
