import { describe, expect, it } from 'vitest';
import { resumeSession, type TodayLog } from './resume';
import { answerInSession, currentStep, startSession } from './session';

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

  it('carries on after the last answered card, keeping the misses for practice', () => {
    const session = resumeSession(['a', 'b', 'c', 'd'], [log('a', true), log('b', false)]);
    expect(session).toEqual({
      scheduled: ['a', 'b', 'c', 'd'],
      practice: ['b'],
      answered: 2,
      correct: 1,
    });
    expect(currentStep(session)).toEqual({ cardId: 'c', kind: 'scheduled' });
  });

  it('the practice round survives leaving: it continues with the next missed card', () => {
    const logs = [log('a', false), log('b', false), log('c', true), log('a', true, true)];
    const session = resumeSession(['a', 'b', 'c'], logs);
    expect(session).toMatchObject({ practice: ['a', 'b'], answered: 4, correct: 1 });
    expect(currentStep(session)).toEqual({ cardId: 'b', kind: 'practice' });
  });

  it('gives the same session as answering without leaving', () => {
    let live = startSession(['a', 'b', 'c']);
    const logs: TodayLog[] = [];
    for (const [correct, kind] of [
      [false, 'scheduled'],
      [true, 'scheduled'],
      [false, 'scheduled'],
      [false, 'practice'],
    ] as const) {
      const step = currentStep(live)!;
      logs.push(log(step.cardId, correct, kind === 'practice'));
      live = answerInSession(live, correct);
      expect(resumeSession(['a', 'b', 'c'], logs)).toEqual(live);
    }
  });

  it('ignores logs of other cards, a second scheduled answer, and practice from before a miss', () => {
    const logs = [
      log('b', true, true), // practice of b before it was missed (another session)
      log('x', false),
      log('b', false),
      log('b', true), // not possible in one session; only the first counts
      log('a', true),
    ];
    const session = resumeSession(['a', 'b'], logs);
    expect(session).toEqual({ scheduled: ['b', 'a'], practice: ['b'], answered: 2, correct: 1 });
    expect(currentStep(session)).toEqual({ cardId: 'b', kind: 'practice' });
  });

  it('a skipped card (answered out of order) moves behind the answered ones', () => {
    const session = resumeSession(['a', 'b', 'c'], [log('b', true)]);
    expect(session.scheduled).toEqual(['b', 'a', 'c']);
    expect(currentStep(session)).toEqual({ cardId: 'a', kind: 'scheduled' });
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
