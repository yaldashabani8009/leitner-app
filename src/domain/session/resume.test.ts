import { describe, expect, it } from 'vitest';
import { resumeSession, type TodayLog } from './resume';
import { answerInSession, currentCard, startSession } from './session';

let minute = 0;
const log = (cardId: string, correct: boolean, isPractice = false): TodayLog => ({
  cardId,
  correct,
  isPractice,
  reviewedAt: `2026-03-10T08:${String((minute += 1)).padStart(2, '0')}:00.000Z`,
});

describe('resumeSession (v3 brief 1.6)', () => {
  it('with no answers yet it is a fresh session', () => {
    expect(resumeSession(['a', 'b', 'c'], [])).toEqual(startSession(['a', 'b', 'c']));
  });

  it('carries on with the first unanswered card, keeping the misses', () => {
    const session = resumeSession(['a', 'b', 'c', 'd'], [log('a', true), log('b', false)]);
    expect(session).toEqual({
      scheduled: ['a', 'b', 'c', 'd'],
      missed: ['b'],
      answered: 2,
      correct: 1,
    });
    expect(currentCard(session)).toBe('c');
  });

  it('a card shown but not answered comes back first (bug 4, 2026-11-09)', () => {
    // The app only logs when a card is answered, so leaving on "c" leaves no trace of it.
    expect(currentCard(resumeSession(['a', 'b', 'c'], [log('a', true), log('b', true)]))).toBe('c');
  });

  it('every card answered: complete, even with misses (no practice round to wait for)', () => {
    const session = resumeSession(['a', 'b'], [log('a', false), log('b', false)]);
    expect(currentCard(session)).toBeNull();
    expect(session.missed).toEqual(['a', 'b']);
  });

  it('cards answered in another session today count here too (bug 3: Mix after the decks)', () => {
    // Mix picked a, b, c; then a deck's own session answered b and c.
    const session = resumeSession(
      ['a', 'b', 'c'],
      [log('a', false), log('b', true), log('c', true)],
    );
    expect(currentCard(session)).toBeNull();
  });

  it('gives the same session as answering without leaving', () => {
    let live = startSession(['a', 'b', 'c']);
    const logs: TodayLog[] = [];
    for (const correct of [false, true, false]) {
      logs.push(log(currentCard(live)!, correct));
      live = answerInSession(live, correct);
      expect(resumeSession(['a', 'b', 'c'], logs)).toEqual(live);
    }
  });

  it('ignores practice answers, logs of other cards and a second answer', () => {
    const logs = [
      log('b', true, true), // practice never counts as answering
      log('x', false),
      log('b', false),
      log('b', true), // only the first real answer counts
      log('a', true),
    ];
    const session = resumeSession(['a', 'b'], logs);
    expect(session).toEqual({ scheduled: ['b', 'a'], missed: ['b'], answered: 2, correct: 1 });
  });

  it('a card answered out of order moves in front of the unanswered ones', () => {
    const session = resumeSession(['a', 'b', 'c'], [log('b', true)]);
    expect(session.scheduled).toEqual(['b', 'a', 'c']);
    expect(currentCard(session)).toBe('a');
  });

  it('logs with the same time keep their order', () => {
    const at = '2026-03-10T09:00:00.000Z';
    const same = (cardId: string, correct: boolean): TodayLog => ({
      cardId,
      correct,
      isPractice: false,
      reviewedAt: at,
    });
    expect(resumeSession(['a', 'b'], [same('a', true), same('b', true)]).answered).toBe(2);
  });

  it('reads logs in time order, whatever order they come in', () => {
    const first = log('a', false);
    const second = log('b', true);
    expect(resumeSession(['a', 'b'], [second, first]).scheduled).toEqual(['a', 'b']);
  });
});
