/**
 * Walking through one session (PRD "Sessions" rules 5–7).
 * The session only tracks order; the caller moves each answered card with the Leitner engine.
 * It ends when every picked card is answered (the progress bar is full). Missed cards are kept
 * so Session complete can offer "Practise the N you missed" (Yali, 2026-11-09); that practice
 * is optional and runs as extra practice, which never moves a card.
 */

export interface Session {
  /** Card ids picked for this session, in order. */
  readonly scheduled: readonly string[];
  /** Cards answered "Not yet", in the order they were missed. */
  readonly missed: readonly string[];
  /** How many cards have been answered so far. */
  readonly answered: number;
  /** Right answers. */
  readonly correct: number;
}

export function startSession(cardIds: readonly string[]): Session {
  return { scheduled: [...cardIds], missed: [], answered: 0, correct: 0 };
}

/** The id of the card to show now, or null when the session is complete. */
export function currentCard(session: Session): string | null {
  return session.answered < session.scheduled.length ? session.scheduled[session.answered] : null;
}

export function isComplete(session: Session): boolean {
  return currentCard(session) === null;
}

/** Cards still to answer: what "Paused · N left" shows. */
export function cardsLeft(session: Session): number {
  return session.scheduled.length - session.answered;
}

/** Records the answer to the current card and returns the next session state. */
export function answerInSession(session: Session, correct: boolean): Session {
  const cardId = currentCard(session);
  if (cardId === null) throw new Error('The session is already complete.');
  return {
    ...session,
    answered: session.answered + 1,
    correct: session.correct + (correct ? 1 : 0),
    missed: correct ? session.missed : [...session.missed, cardId],
  };
}
