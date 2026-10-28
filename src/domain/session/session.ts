/**
 * Walking through one session (PRD "Sessions" rules 5–7).
 * The session only tracks order; the caller moves cards with the Leitner engine
 * for "scheduled" steps and changes nothing for "practice" steps.
 */

export interface Session {
  /** Card ids picked for this session, in order. */
  readonly scheduled: readonly string[];
  /** Cards missed in the scheduled part, in the order they were missed; each is repeated once. */
  readonly practice: readonly string[];
  /** How many answers have been given so far (scheduled first, then practice). */
  readonly answered: number;
  /** Right answers in the scheduled part (practice answers are not scored). */
  readonly correct: number;
}

export interface Step {
  readonly cardId: string;
  /** "scheduled" → move the card and log it; "practice" → log it as practice, change nothing. */
  readonly kind: 'scheduled' | 'practice';
}

export function startSession(cardIds: readonly string[]): Session {
  return { scheduled: [...cardIds], practice: [], answered: 0, correct: 0 };
}

/** The card to show now, or null when the session is complete. */
export function currentStep(session: Session): Step | null {
  const { scheduled, practice, answered } = session;
  if (answered < scheduled.length) return { cardId: scheduled[answered], kind: 'scheduled' };
  const practiceIndex = answered - scheduled.length;
  if (practiceIndex < practice.length) return { cardId: practice[practiceIndex], kind: 'practice' };
  return null;
}

export function isComplete(session: Session): boolean {
  return currentStep(session) === null;
}

/** Records the answer to the current step and returns the next session state. */
export function answerInSession(session: Session, correct: boolean): Session {
  const step = currentStep(session);
  if (step === null) throw new Error('The session is already complete.');

  if (step.kind === 'practice') return { ...session, answered: session.answered + 1 };
  return {
    ...session,
    answered: session.answered + 1,
    correct: session.correct + (correct ? 1 : 0),
    practice: correct ? session.practice : [...session.practice, step.cardId],
  };
}
