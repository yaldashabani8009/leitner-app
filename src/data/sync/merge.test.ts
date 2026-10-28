import { describe, expect, it } from 'vitest';
import type { EntryRow } from '../db';
import { planEntryMerge, remoteWins, shouldAddLog, timeMs } from './merge';

describe('timeMs', () => {
  it.each([
    ['2026-03-10T08:15:00.000Z', Date.UTC(2026, 2, 10, 8, 15)],
    ['2026-03-10T08:15:00.123456+00:00', Date.UTC(2026, 2, 10, 8, 15, 0, 123)],
    ['2026-03-10 08:15:00.1+00', Date.UTC(2026, 2, 10, 8, 15, 0, 100)],
    ['2026-03-10T11:45:00+03:30', Date.UTC(2026, 2, 10, 8, 15)],
    ['2026-03-10T08:15:00', Date.UTC(2026, 2, 10, 8, 15)],
    ['2026-03-10T08:15Z', Date.UTC(2026, 2, 10, 8, 15)],
  ])('reads %s', (text, ms) => {
    expect(timeMs(text)).toBe(ms);
  });

  it.each(['yesterday', '2026-03-10', '2026-13-10T08:15:00Z'])('rejects %s', (text) => {
    expect(() => timeMs(text)).toThrow(RangeError);
  });
});

describe('remoteWins (last write wins)', () => {
  const at = (updatedAt: string) => ({ updatedAt });

  it('a row the device does not have yet is always taken', () => {
    expect(remoteWins(undefined, at('2026-03-10T08:00:00Z'))).toBe(true);
  });

  it('newer cloud copy wins, older loses', () => {
    expect(remoteWins(at('2026-03-10T08:00:00.000Z'), at('2026-03-10T08:00:00.001Z'))).toBe(true);
    expect(remoteWins(at('2026-03-10T08:00:00.001Z'), at('2026-03-10T08:00:00.000Z'))).toBe(false);
  });

  it('same moment keeps the device copy, whatever the format', () => {
    expect(remoteWins(at('2026-03-10T08:00:00.000Z'), at('2026-03-10T08:00:00.000000+00:00'))).toBe(
      false,
    );
  });
});

describe('shouldAddLog (append-only)', () => {
  it('adds only logs the device does not have', () => {
    expect(shouldAddLog(undefined)).toBe(true);
    expect(shouldAddLog({ id: 'l1' })).toBe(false);
  });
});

describe('planEntryMerge', () => {
  let n = 0;
  const entry = (
    kind: EntryRow['kind'],
    text: string,
    position: number,
    deletedAt: string | null = null,
  ): EntryRow => ({
    id: `e${++n}`,
    cardId: 'c',
    kind,
    text,
    position,
    updatedAt: '2026-03-10T08:00:00Z',
    deletedAt,
  });

  it('moves new items after the cloud ones, per list', () => {
    const cloud = [
      entry('synonym', 'bold', 0),
      entry('synonym', 'daring', 1),
      entry('meaning', 'شجاع', 0),
    ];
    const fearless = entry('synonym', 'fearless', 0);
    const sentence = entry('sentence', 'She was brave.', 0);
    const plan = planEntryMerge(cloud, [fearless, sentence]);
    expect(plan.move).toEqual([
      { entry: fearless, position: 2 },
      { entry: sentence, position: 0 },
    ]);
    expect(plan.drop).toEqual([]);
  });

  it('drops repeats, ignoring capitals and spaces, within the same list only', () => {
    const cloud = [entry('synonym', 'bold', 0)];
    const repeat = entry('synonym', ' Bold ', 0);
    const otherList = entry('sentence', 'bold', 0);
    const plan = planEntryMerge(cloud, [repeat, otherList]);
    expect(plan.drop).toEqual([repeat]);
    expect(plan.move.map((m) => m.entry)).toEqual([otherList]);
  });

  it('keeps the device order and ignores deleted items on both sides', () => {
    const cloud = [entry('synonym', 'old', 0, '2026-03-09T00:00:00Z')];
    const second = entry('synonym', 'second', 1);
    const first = entry('synonym', 'first', 0);
    const gone = entry('synonym', 'gone', 2, '2026-03-09T00:00:00Z');
    const plan = planEntryMerge(cloud, [second, gone, first]);
    expect(plan.move).toEqual([
      { entry: first, position: 0 },
      { entry: second, position: 1 },
    ]);
  });

  it('two identical device items: the second is a repeat', () => {
    const a = entry('meaning', 'دلیر', 0);
    const b = entry('meaning', 'دلیر', 1);
    expect(planEntryMerge([], [a, b])).toEqual({ move: [{ entry: a, position: 0 }], drop: [b] });
  });
});
