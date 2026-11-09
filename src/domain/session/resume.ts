/**
 * Leaving a session and coming back (v3 brief 1.6): only the session's card list is saved;
 * where you were, and which cards were missed, are worked out from today's review logs, so
 * nothing is lost if the app is closed or another deck is studied in between.
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
 * A card with a real (not practice) answer today has been answered, in this session or in
 * another one (a deck's own session after Mix them all, say). Answered cards come first, in the
 * order they were answered, so the session carries on with the next unanswered one.
 */
export function resumeSession(scheduled: readonly string[], logs: readonly TodayLog[]): Session {
  const inSession = new Set(scheduled);
  const ordered = logs
    .filter((log) => !log.isPractice && inSession.has(log.cardId))
    .sort((a, b) => (a.reviewedAt < b.reviewedAt ? -1 : a.reviewedAt > b.reviewedAt ? 1 : 0));

  const answered: string[] = [];
  const answer = new Map<string, boolean>();
  for (const log of ordered) {
    if (answer.has(log.cardId)) continue;
    answer.set(log.cardId, log.correct);
    answered.push(log.cardId);
  }
  return {
    scheduled: [...answered, ...scheduled.filter((id) => !answer.has(id))],
    missed: answered.filter((id) => answer.get(id) === false),
    answered: answered.length,
    correct: answered.filter((id) => answer.get(id)).length,
  };
}
