import { describe, expect, it } from 'vitest';
import {
  dayHeading,
  listItems,
  matchesSearch,
  normalizeForSearch,
  progressLabel,
  sortRows,
  type WordRow,
} from './allWords';

const row = (word: string, over: Partial<WordRow> = {}): WordRow => ({
  id: word,
  word,
  deck: 'vocab',
  box: 1,
  mastered: false,
  addedOn: '2026-10-31',
  createdAt: '2026-10-31T08:00:00.000Z',
  meanings: [],
  misses: 0,
  ...over,
});

describe('search (v3 brief 1.9)', () => {
  it('normalises Persian: ي = ی, ك = ک, the half-space is ignored', () => {
    expect(normalizeForSearch('كتاب')).toBe(normalizeForSearch('کتاب'));
    expect(normalizeForSearch('علي')).toBe(normalizeForSearch('علی'));
    expect(normalizeForSearch('می‌خواهم')).toBe('میخواهم');
    expect(normalizeForSearch('  Hello   World ')).toBe('hello world');
  });

  it('matches the word and its Persian meanings as you type', () => {
    const meticulous = row('Meticulous', { meanings: ['دقیق', 'وسواسی'] });
    expect(matchesSearch(meticulous, 'meti')).toBe(true);
    expect(matchesSearch(meticulous, 'دقي')).toBe(true); // Arabic ي typed
    expect(matchesSearch(meticulous, 'brave')).toBe(false);
    expect(matchesSearch(meticulous, '  ')).toBe(true);
    expect(matchesSearch(row('x', { meanings: ['بی‌میل'] }), 'بیمیل')).toBe(true);
  });
});

describe('sortRows', () => {
  const rows = [
    row('charm', {
      addedOn: '2026-10-31',
      createdAt: '2026-10-31T09:00:00.000Z',
      box: 2,
      misses: 1,
    }),
    row('Ambiguous', { addedOn: '2026-09-14', box: 3, misses: 3 }),
    row('brave', {
      addedOn: '2026-10-31',
      createdAt: '2026-10-31T08:00:00.000Z',
      box: 1,
      misses: 1,
    }),
    row('calm', { addedOn: '2026-10-30', box: 5, mastered: true, misses: 1 }),
    row('dusk', { addedOn: '2026-10-31', createdAt: '2026-10-31T08:00:00.000Z', misses: 0 }),
  ];
  const words = (sorted: WordRow[]) => sorted.map((r) => r.word);

  it('by day: newest first', () => {
    expect(words(sortRows(rows, 'day'))).toEqual(['charm', 'brave', 'dusk', 'calm', 'Ambiguous']);
  });

  it('A–Z ignores capitals', () => {
    expect(words(sortRows(rows, 'az'))).toEqual(['Ambiguous', 'brave', 'calm', 'charm', 'dusk']);
  });

  it('needs work: most misses first, ties by lowest box, mastered last', () => {
    expect(words(sortRows(rows, 'needsWork'))).toEqual([
      'Ambiguous',
      'brave',
      'charm',
      'calm',
      'dusk',
    ]);
  });
});

describe('sortRows: ties', () => {
  it('the same word in two decks, the same time, the same misses and box stay in a stable order', () => {
    const a = row('brave', { id: 'a', deck: 'vocab' });
    const b = row('brave', { id: 'b', deck: 'spelling' });
    for (const sort of ['day', 'az', 'needsWork'] as const) {
      expect(sortRows([b, a], sort).map((r) => r.id)).toEqual(['a', 'b']);
      expect(sortRows([a, b], sort).map((r) => r.id)).toEqual(['a', 'b']);
    }
  });
});

describe('sortRows: by day, the later time first whatever the input order', () => {
  it('orders by time within a day', () => {
    const early = row('early', { createdAt: '2026-10-31T07:00:00.000Z' });
    const late = row('late', { createdAt: '2026-10-31T10:00:00.000Z' });
    expect(sortRows([early, late], 'day').map((r) => r.word)).toEqual(['late', 'early']);
    expect(sortRows([late, early], 'day').map((r) => r.word)).toEqual(['late', 'early']);
    const old = row('old', { addedOn: '2026-10-01' });
    expect(sortRows([old, late], 'day').map((r) => r.word)).toEqual(['late', 'old']);
    expect(sortRows([late, old], 'day').map((r) => r.word)).toEqual(['late', 'old']);
  });
});

describe('day headings', () => {
  it('TODAY, YESTERDAY, 14 SEP, and the year when it is another one', () => {
    expect(dayHeading('2026-10-31', '2026-10-31')).toBe('TODAY');
    expect(dayHeading('2026-10-30', '2026-10-31')).toBe('YESTERDAY');
    expect(dayHeading('2026-09-14', '2026-10-31')).toBe('14 SEP');
    expect(dayHeading('2025-12-01', '2026-10-31')).toBe('1 DEC 2025');
  });

  it('by day has a heading per day; the other sorts have none', () => {
    const rows = [row('a'), row('b', { addedOn: '2026-10-30' }), row('c')];
    expect(
      listItems(rows, 'day', '2026-10-31').map((i) => (i.kind === 'row' ? i.row.word : i.label)),
    ).toEqual(['TODAY', 'a', 'c', 'YESTERDAY', 'b']);
    expect(listItems(rows, 'az', '2026-10-31').every((i) => i.kind === 'row')).toBe(true);
  });
});

describe('progressLabel', () => {
  it('says the box, or Mastered', () => {
    expect(progressLabel({ box: 3, mastered: false })).toBe('Box 3 of 5');
    expect(progressLabel({ box: 5, mastered: true })).toBe('Mastered');
  });
});
