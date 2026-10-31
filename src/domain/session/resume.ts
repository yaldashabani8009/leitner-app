/**
 * Leaving a session and coming back (v3 brief 1.6): only the session's card list is saved;
 * where you were, and which cards wait in the practice round, are worked out from today's
 * review logs, so nothing is lost if the app is closed or another deck is studied in between.
 */

import type { Session } from './session';

export interface TodayLog {
  readonly cardId: string;
  readonly correct: boolean;
  readonly isPractice: boolean;
  /** UTC ISO timestamp. */
  readonly reviewedAt: string;
}

/**
 * The session for `scheduled` (the cards picked when it started), given today's review logs.
 * A card with a scheduled answer today has been answered; a "Not yet" puts it in the practice
 * round, which is done once a practice answer for it follows. Answered cards come first, in the
 * order they were answered, so the session carries on with the next unanswered one.
 */
export function resumeSession(scheduled: readonly string[], logs: readonly TodayLog[]): Session {
  const inSession = new Set(scheduled);
  const ordered = logs
    .filter((log) => inSession.has(log.cardId))
    .sort((a, b) => (a.reviewedAt < b.reviewedAt ? -1 : a.reviewedAt > b.reviewedAt ? 1 : 0));

  const answered: string[] = [];
  const answer = new Map<string, boolean>();
  const missedAt = new Map<string, string>();
  const practised = new Set<string>();
  for (const log of ordered) {
    if (!log.isPractice) {
      if (answer.has(log.cardId)) continue;
      answer.set(log.cardId, log.correct);
      answered.push(log.cardId);
      if (!log.correct) missedAt.set(log.cardId, log.reviewedAt);
    } else if (missedAt.has(log.cardId) && log.reviewedAt >= missedAt.get(log.cardId)!) {
      practised.add(log.cardId);
    }
  }

  const practice = answered.filter((id) => answer.get(id) === false);
  const allAnswered = answered.length === scheduled.length;
  // The practice round only starts once every scheduled card is answered; it goes in order.
  let practiceDone = 0;
  if (allAnswered) {
    while (practiceDone < practice.length && practised.has(practice[practiceDone])) practiceDone++;
  }
  return {
    scheduled: [...answered, ...scheduled.filter((id) => !answer.has(id))],
    practice,
    answered: answered.length + practiceDone,
    correct: answered.filter((id) => answer.get(id)).length,
  };
}
