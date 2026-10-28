import { describe, expect, it } from 'vitest';
import { addDays, assertCalendarDate, isOnOrBefore } from './calendarDate';

describe('addDays', () => {
  it('adds days inside a month', () => {
    expect(addDays('2026-03-10', 1)).toBe('2026-03-11');
    expect(addDays('2026-03-10', 16)).toBe('2026-03-26');
  });

  it('crosses month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-12-20', 16)).toBe('2027-01-05');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('is not affected by daylight-saving changes (dates have no time zone)', () => {
    // US clocks jump on 2026-03-08 and fall back on 2026-11-01; Tehran has no DST.
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });

  it('goes back with negative days and stays put with zero', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10');
  });

  it('rejects fractional days', () => {
    expect(() => addDays('2026-03-10', 1.5)).toThrow(RangeError);
  });
});

describe('isOnOrBefore', () => {
  it('compares calendar dates', () => {
    expect(isOnOrBefore('2026-03-09', '2026-03-10')).toBe(true);
    expect(isOnOrBefore('2026-03-10', '2026-03-10')).toBe(true);
    expect(isOnOrBefore('2026-03-11', '2026-03-10')).toBe(false);
    expect(isOnOrBefore('2025-12-31', '2026-01-01')).toBe(true);
  });
});

describe('assertCalendarDate', () => {
  it('accepts real dates', () => {
    expect(() => assertCalendarDate('2028-02-29')).not.toThrow();
  });

  it.each([
    '2026-13-45',
    '2026-02-30',
    '2026-02-29',
    '2026-3-10',
    '10/03/2026',
    '2026-03-10T00:00:00Z',
    '',
  ])('rejects "%s"', (bad) => {
    expect(() => assertCalendarDate(bad)).toThrow(RangeError);
  });
});
