/**
 * The daily reminder (Yali, 2026-10-29; ADR-018): one notification a day from 19:00 in the
 * profile time zone, only when there is something to do. Pure: shared by the server function
 * that sends it (supabase/functions) and tested here.
 */

import { DAILY_REMINDER_HOUR, DAILY_REMINDER_LAST_HOUR, DAILY_REVIEW_CAP } from '../leitner/config';
import type { CalendarDate } from '../time/calendarDate';
import { dateInZone, hourInZone } from '../time/zonedDate';

export interface ReminderTime {
  /** UTC ISO timestamp. */
  now: string;
  /** Profile time zone. */
  timeZone: string;
  /** Profile-zone date this phone was last considered; null if never. */
  lastRemindedOn: CalendarDate | null;
}

/** Between 19:00 and 23:00 in the profile's zone, and not yet considered today. */
export function isReminderTime({ now, timeZone, lastRemindedOn }: ReminderTime): boolean {
  const hour = hourInZone(now, timeZone);
  return (
    hour >= DAILY_REMINDER_HOUR &&
    hour < DAILY_REMINDER_LAST_HOUR &&
    lastRemindedOn !== dateInZone(now, timeZone)
  );
}

export interface ReminderFacts {
  /** Cards due today (box schedule; mastered and deleted cards excluded). */
  dueCount: number;
  /** Scheduled reviews already done today (practice doesn't count). */
  reviewsToday: number;
  /** Today already counts for the streak. */
  earnedToday: boolean;
  /** Days in a row up to yesterday (today isn't earned yet when a reminder is sent). */
  streak: number;
}

/**
 * Words still to review today: the due cards, but never past the daily cap of 100 reviews.
 * The number on the app icon, and the "12 words are waiting" in the reminder.
 */
export function waitingToday(dueCount: number, reviewsToday: number): number {
  return Math.min(dueCount, Math.max(0, DAILY_REVIEW_CAP - reviewsToday));
}

export interface ReminderMessage {
  title: string;
  body: string;
  /** The number on the app icon: words still waiting today (0 clears it). */
  badge: number;
}

/**
 * What the reminder says, or null for no reminder (the day is already done, or the daily cap
 * of 100 reviews is reached). Words waiting come first; otherwise a nudge to add a word,
 * because adding one keeps the streak on a day with nothing due (PRD streak rule 3).
 */
export function reminderMessage(facts: ReminderFacts): ReminderMessage | null {
  if (facts.earnedToday) return null;
  const waiting = waitingToday(facts.dueCount, facts.reviewsToday);
  if (waiting > 0) {
    return {
      title: 'Time for your words',
      body: waiting === 1 ? '1 word is waiting for you.' : `${waiting} words are waiting for you.`,
      badge: waiting,
    };
  }
  if (facts.dueCount > 0) return null; // the daily cap is reached; rest
  return {
    title: 'Keep your streak going',
    body:
      facts.streak > 0
        ? `Add a word to keep your ${facts.streak}-day streak.`
        : 'Add a new word today and start a streak.',
    badge: 0,
  };
}

/** Sent once, right after reminders are turned on, so you know they work. */
export const TEST_MESSAGE = {
  title: 'Reminders are on',
  body: "I'll let you know at 19:00 when words are waiting, or when your streak needs a new word.",
} as const;
