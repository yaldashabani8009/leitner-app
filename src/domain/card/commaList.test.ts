import { describe, expect, it } from 'vitest';
import { itemsFromText, joinList, splitList } from './commaList';

describe('splitList', () => {
  it('splits on a comma', () => {
    expect(splitList('careful, precise, thorough')).toEqual(['careful', 'precise', 'thorough']);
  });

  it('splits on a Persian comma, and on both mixed', () => {
    expect(splitList('دقیق، وسواسی، موشکاف')).toEqual(['دقیق', 'وسواسی', 'موشکاف']);
    expect(splitList('دقیق, وسواسی،موشکاف')).toEqual(['دقیق', 'وسواسی', 'موشکاف']);
  });

  it('trims, squeezes inner spaces and drops empty pieces', () => {
    expect(splitList('  a  ,, b   c ,  ,')).toEqual(['a', 'b c']);
    expect(splitList('')).toEqual([]);
    expect(splitList(' , ، ')).toEqual([]);
  });

  it('keeps a repeated item once, ignoring capitals', () => {
    expect(splitList('Careful, careful, CAREFUL, precise')).toEqual(['Careful', 'precise']);
  });

  it('keeps a single item without commas', () => {
    expect(splitList('ice cream')).toEqual(['ice cream']);
  });
});

describe('joinList', () => {
  it('joins English items with ", " and Persian ones with "، "', () => {
    expect(joinList(['careful', 'precise'])).toBe('careful, precise');
    expect(joinList(['دقیق', 'وسواسی'], true)).toBe('دقیق، وسواسی');
  });

  it('round-trips through splitList', () => {
    const items = ['careful', 'precise'];
    expect(splitList(joinList(items))).toEqual(items);
    expect(splitList(joinList(['دقیق', 'وسواسی'], true))).toEqual(['دقیق', 'وسواسی']);
  });
});

describe('itemsFromText', () => {
  const saved = [
    { id: 'e1', text: 'careful' },
    { id: 'e2', text: 'precise' },
  ];

  it('makes new items when nothing is saved yet', () => {
    expect(itemsFromText('bold, daring')).toEqual([{ text: 'bold' }, { text: 'daring' }]);
  });

  it('keeps the id of unchanged items (any capitals) and adds new ones', () => {
    expect(itemsFromText('Precise, careful, exact', saved)).toEqual([
      { id: 'e2', text: 'Precise' },
      { id: 'e1', text: 'careful' },
      { text: 'exact' },
    ]);
  });

  it('leaves out removed items (the repository soft-deletes them)', () => {
    expect(itemsFromText('precise', saved)).toEqual([{ id: 'e2', text: 'precise' }]);
  });

  it('uses each saved id only once', () => {
    expect(
      itemsFromText('careful', [
        { id: 'a', text: 'careful' },
        { id: 'b', text: 'careful' },
      ]),
    ).toEqual([{ id: 'a', text: 'careful' }]);
  });
});
