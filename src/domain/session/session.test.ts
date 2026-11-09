import { describe, expect, it } from 'vitest';
import {
  answerInSession,
  cardsLeft,
  currentCard,
  isComplete,
  startSession,
  type Session,
} from './session';

const ids = (count: number) => Array.from({ length: count }, (_, i) => `c${i + 1}`);

/** Answers every card in turn; `wrong` lists the card ids answered "Not yet". */
function play(session: Session, wrong: string[] = []): { shown: string[]; end: Session } {
  const shown: string[] = [];
  let card = currentCard(session);
  while (card) {
    shown.push(card);
    session = answerInSession(session, !wrong.includes(card));
    card = currentCard(session);
  }
  return { shown, end: session };
}

describe('startSession', () => {
  it('starts on the first card', () => {
    expect(currentCard(startSession(['a', 'b']))).toBe('a');
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

describe('the session ends when every card is answered (Yali, 2026-11-09)', () => {
  it('all right: each card once, then complete', () => {
    const { shown, end } = play(startSession(ids(20)));
    expect(shown).toEqual(ids(20));
    expect(isComplete(end)).toBe(true);
    expect(end.correct).toBe(20);
    expect(end.missed).toEqual([]);
  });

  it('3 misses out of 20: still complete after the 20; the misses are kept in the order missed', () => {
    const { shown, end } = play(startSession(ids(20)), ['c12', 'c3', 'c17']);
    expect(shown).toEqual(ids(20)); // no automatic practice round
    expect(isComplete(end)).toBe(true);
    expect(end.missed).toEqual(['c3', 'c12', 'c17']);
    expect(end.correct).toBe(17);
  });
});

describe('leaving mid-session (rule 7)', () => {
  it('after 5 answers, 15 cards are left and the 6th card is next', () => {
    let session = startSession(ids(20));
    for (let i = 0; i < 5; i++) session = answerInSession(session, i !== 2);
    expect(currentCard(session)).toBe('c6');
    expect(cardsLeft(session)).toBe(15);
    expect(session.missed).toEqual(['c3']);
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
