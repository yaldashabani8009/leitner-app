import { describe, expect, it } from 'vitest';
import {
  answerInSession,
  currentStep,
  isComplete,
  startSession,
  type Session,
  type Step,
} from './session';

const ids = (count: number) => Array.from({ length: count }, (_, i) => `c${i + 1}`);

/** Answers every step in turn; `wrong` lists the card ids answered "Not yet" in the scheduled part. */
function play(session: Session, wrong: string[] = []): { steps: Step[]; end: Session } {
  const steps: Step[] = [];
  let step = currentStep(session);
  while (step) {
    steps.push(step);
    const correct = !(step.kind === 'scheduled' && wrong.includes(step.cardId));
    session = answerInSession(session, correct);
    step = currentStep(session);
  }
  return { steps, end: session };
}

describe('startSession', () => {
  it('starts on the first card as a scheduled review', () => {
    expect(currentStep(startSession(['a', 'b']))).toEqual({ cardId: 'a', kind: 'scheduled' });
  });

  it('an empty session is complete straight away', () => {
    expect(isComplete(startSession([]))).toBe(true);
  });

  it('copies the ids so later changes to the list do not leak in', () => {
    const list = ['a'];
    const session = startSession(list);
    list.push('b');
    expect(session.scheduled).toEqual(['a']);
  });
});

describe('all right: no practice round', () => {
  it('shows each card once as scheduled, then completes', () => {
    const { steps, end } = play(startSession(ids(20)));
    expect(steps).toHaveLength(20);
    expect(steps.every((s) => s.kind === 'scheduled')).toBe(true);
    expect(isComplete(end)).toBe(true);
    expect(end.correct).toBe(20);
    expect(end.practice).toEqual([]);
  });
});

describe('wrong answers are repeated once at the end as practice (rules 5–6)', () => {
  it('3 misses out of 20 → those 3 come back after the 20, in the order missed', () => {
    const { steps, end } = play(startSession(ids(20)), ['c12', 'c3', 'c17']);
    expect(steps).toHaveLength(23);
    expect(steps.slice(0, 20).every((s) => s.kind === 'scheduled')).toBe(true);
    expect(steps.slice(20)).toEqual([
      { cardId: 'c3', kind: 'practice' },
      { cardId: 'c12', kind: 'practice' },
      { cardId: 'c17', kind: 'practice' },
    ]);
    expect(end.correct).toBe(17);
    expect(isComplete(end)).toBe(true);
  });

  it('a practice answer is marked "practice" so nothing gets rescheduled', () => {
    let session = answerInSession(startSession(['a']), false);
    expect(currentStep(session)).toEqual({ cardId: 'a', kind: 'practice' });
    session = answerInSession(session, true);
    expect(isComplete(session)).toBe(true);
  });

  it('missing a card again in practice does not repeat it a third time', () => {
    let session = answerInSession(startSession(['a', 'b']), false); // a wrong
    session = answerInSession(session, true); // b right
    session = answerInSession(session, false); // a wrong again, in practice
    expect(isComplete(session)).toBe(true);
    expect(session.practice).toEqual(['a']);
  });

  it('practice answers are not scored', () => {
    let session = answerInSession(startSession(['a']), false);
    session = answerInSession(session, true);
    expect(session.correct).toBe(0);
  });

  it('every card wrong → every card practised once', () => {
    const { steps } = play(startSession(ids(5)), ids(5));
    expect(steps.filter((s) => s.kind === 'practice').map((s) => s.cardId)).toEqual(ids(5));
  });
});

describe('leaving mid-session (rule 7)', () => {
  it('after 5 answers, the 15 unanswered cards were never reviewed', () => {
    let session = startSession(ids(20));
    for (let i = 0; i < 5; i++) session = answerInSession(session, true);
    expect(session.answered).toBe(5);
    expect(currentStep(session)).toEqual({ cardId: 'c6', kind: 'scheduled' });
    // Only the 5 answered cards were moved by the caller; the rest stay due.
    expect(session.scheduled.slice(session.answered)).toHaveLength(15);
  });
});

describe('safety', () => {
  it('rejects an answer after the session is complete', () => {
    const { end } = play(startSession(['a']));
    expect(() => answerInSession(end, true)).toThrow(/complete/);
  });

  it('never changes the session it was given', () => {
    const session = startSession(['a', 'b']);
    const copy = structuredClone(session);
    answerInSession(session, false);
    expect(session).toEqual(copy);
  });
});
