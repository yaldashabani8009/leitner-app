import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDue, newCard } from '../leitner/engine';
import {
  dateInZone,
  dateOfTimestampInZone,
  FALLBACK_TIME_ZONE,
  hourInZone,
  isValidTimeZone,
  resolveTimeZone,
} from './zonedDate';

const TEHRAN = 'Asia/Tehran'; // UTC+3:30, no daylight saving
const NEW_YORK = 'America/New_York'; // UTC-5 / UTC-4 in summer

/** Pretend the phone's own time-zone setting is `zone` (what Yali does when testing). */
function phoneIn(zone: string): void {
  vi.stubEnv('TZ', zone);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('dateInZone: local midnight', () => {
  it.each([
    ['Tehran, just before midnight', '2026-03-09T20:29:59Z', TEHRAN, '2026-03-09'],
    ['Tehran, at midnight', '2026-03-09T20:30:00Z', TEHRAN, '2026-03-10'],
    ['New York, just before midnight', '2026-03-10T03:59:59.999Z', NEW_YORK, '2026-03-09'],
    ['New York, at midnight', '2026-03-10T04:00:00.000Z', NEW_YORK, '2026-03-10'],
    ['UTC, just before midnight', '2026-03-09T23:59:59.999Z', 'UTC', '2026-03-09'],
    ['UTC, at midnight', '2026-03-10T00:00Z', 'UTC', '2026-03-10'],
    ['Tehran, new year', '2026-12-31T20:30:00Z', TEHRAN, '2027-01-01'],
  ])('%s', (_label, instant, zone, expected) => {
    expect(dateInZone(instant, zone)).toBe(expected);
  });
});

describe('dateInZone: daylight saving (New York)', () => {
  // Clocks jump forward on 2026-03-08: midnight before is UTC-5, midnight after is UTC-4.
  it.each([
    ['2026-03-08T04:59:59Z', '2026-03-07'],
    ['2026-03-08T05:00:00Z', '2026-03-08'],
    ['2026-03-09T03:59:59Z', '2026-03-08'],
    ['2026-03-09T04:00:00Z', '2026-03-09'],
  ])('spring forward: %s → %s', (instant, expected) => {
    expect(dateInZone(instant, NEW_YORK)).toBe(expected);
  });

  // Clocks fall back on 2026-11-01: midnight before is UTC-4, midnight after is UTC-5.
  it.each([
    ['2026-11-01T03:59:59Z', '2026-10-31'],
    ['2026-11-01T04:00:00Z', '2026-11-01'],
    ['2026-11-02T04:59:59Z', '2026-11-01'],
    ['2026-11-02T05:00:00Z', '2026-11-02'],
  ])('fall back: %s → %s', (instant, expected) => {
    expect(dateInZone(instant, NEW_YORK)).toBe(expected);
  });

  it('Tehran keeps UTC+3:30 in summer (no daylight saving)', () => {
    expect(dateInZone('2026-06-15T20:29:59Z', TEHRAN)).toBe('2026-06-15');
    expect(dateInZone('2026-06-15T20:30:00Z', TEHRAN)).toBe('2026-06-16');
  });
});

describe('dateInZone: any IANA zone', () => {
  it.each([
    ['Asia/Kathmandu (+5:45)', 'Asia/Kathmandu', '2026-03-09T18:14:59Z', '2026-03-09'],
    ['Asia/Kathmandu (+5:45)', 'Asia/Kathmandu', '2026-03-09T18:15:00Z', '2026-03-10'],
    ['Pacific/Kiritimati (+14)', 'Pacific/Kiritimati', '2026-03-09T09:59:59Z', '2026-03-09'],
    ['Pacific/Kiritimati (+14)', 'Pacific/Kiritimati', '2026-03-09T10:00:00Z', '2026-03-10'],
    ['Pacific/Pago_Pago (-11)', 'Pacific/Pago_Pago', '2026-03-10T10:59:59Z', '2026-03-09'],
    ['Pacific/Pago_Pago (-11)', 'Pacific/Pago_Pago', '2026-03-10T11:00:00Z', '2026-03-10'],
  ])('%s: %s at %s → %s', (_label, zone, instant, expected) => {
    expect(dateInZone(instant, zone)).toBe(expected);
  });
});

describe('phone time zone ≠ profile time zone', () => {
  // 02:00 UTC on 10 March = 05:30 on the 10th in Tehran, 22:00 on the 9th in New York.
  const NOW = '2026-03-10T02:00:00.000Z';

  it.each([
    [TEHRAN, NEW_YORK, '2026-03-09'],
    [NEW_YORK, TEHRAN, '2026-03-10'],
    [TEHRAN, TEHRAN, '2026-03-10'],
    [NEW_YORK, NEW_YORK, '2026-03-09'],
  ])('phone on %s, profile on %s → today is %s', (phone, profile, expected) => {
    phoneIn(phone);
    expect(dateInZone(NOW, profile)).toBe(expected);
  });

  it('the simulated phone zone really changes what the phone thinks (sanity check)', () => {
    const moment = new Date(Date.parse(NOW));
    phoneIn(TEHRAN);
    expect(moment.getTimezoneOffset()).toBe(-210);
    expect(moment.getDate()).toBe(10);
    phoneIn(NEW_YORK);
    expect(moment.getTimezoneOffset()).toBe(240);
    expect(moment.getDate()).toBe(9);
  });

  it('due cards follow the profile, not the phone', () => {
    const card = { box: 2 as const, dueDate: '2026-03-10', masteredAt: null };
    for (const phone of [TEHRAN, NEW_YORK]) {
      phoneIn(phone);
      expect(isDue(card, dateInZone(NOW, NEW_YORK))).toBe(false);
      expect(isDue(card, dateInZone(NOW, TEHRAN))).toBe(true);
    }
  });

  it('a new card is due tomorrow in the profile zone, whatever the phone says', () => {
    for (const phone of [TEHRAN, NEW_YORK]) {
      phoneIn(phone);
      expect(newCard(dateInZone(NOW, NEW_YORK)).dueDate).toBe('2026-03-10');
      expect(newCard(dateInZone(NOW, TEHRAN)).dueDate).toBe('2026-03-11');
    }
  });

  it('the daily cap counts reviews on the profile day, whatever the phone says', () => {
    const reviewedAt = [
      '2026-03-09T20:00:00Z', // Tehran: 9th 23:30 · New York: 9th 16:00
      '2026-03-09T21:00:00Z', // Tehran: 10th 00:30 · New York: 9th 17:00
      '2026-03-10T01:00:00Z', // Tehran: 10th 04:30 · New York: 9th 21:00
    ];
    const reviewsToday = (profile: string) =>
      reviewedAt.filter((at) => dateInZone(at, profile) === dateInZone(NOW, profile)).length;

    for (const phone of [TEHRAN, NEW_YORK]) {
      phoneIn(phone);
      expect(reviewsToday(TEHRAN)).toBe(2);
      expect(reviewsToday(NEW_YORK)).toBe(3);
    }
  });
});

describe('dateInZone: bad input', () => {
  it.each(['Asia/Tehrann', 'Mars/Olympus', ''])('rejects unknown zone "%s"', (zone) => {
    expect(() => dateInZone('2026-03-10T02:00:00Z', zone)).toThrow(RangeError);
  });

  it.each([
    '2026-03-10', // no time
    '2026-03-10T08:00:00+03:30', // not UTC
    '2026-03-10 08:00:00Z', // space instead of T
    '2026-02-30T00:00:00Z', // impossible date
    '2026-03-10T25:00:00Z', // impossible time
    'yesterday',
  ])('rejects timestamp "%s"', (instant) => {
    expect(() => dateInZone(instant, TEHRAN)).toThrow(RangeError);
  });
});

describe('isValidTimeZone', () => {
  it('accepts real zones', () => {
    expect(isValidTimeZone(TEHRAN)).toBe(true);
    expect(isValidTimeZone(NEW_YORK)).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects made-up zones', () => {
    expect(isValidTimeZone('Asia/Tehrann')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('resolveTimeZone (missing or broken profile zone → UTC, option A)', () => {
  it('keeps a real profile zone', () => {
    expect(resolveTimeZone(TEHRAN)).toBe(TEHRAN);
  });

  it.each([null, undefined, '', 'Asia/Tehrann'])('falls back to UTC for %s', (zone) => {
    expect(resolveTimeZone(zone)).toBe(FALLBACK_TIME_ZONE);
    expect(FALLBACK_TIME_ZONE).toBe('UTC');
  });

  it('never falls back to the phone zone', () => {
    phoneIn(TEHRAN);
    expect(resolveTimeZone(null)).toBe('UTC');
  });
});

describe('hourInZone', () => {
  it('is the hour on the clock in that zone', () => {
    expect(hourInZone('2026-10-29T15:30:00.000Z', 'Asia/Tehran')).toBe(19);
    expect(hourInZone('2026-10-29T20:30:00.000Z', 'Asia/Tehran')).toBe(0);
    expect(hourInZone('2026-10-29T23:30:00.000Z', 'America/New_York')).toBe(19);
  });

  it('throws on a bad timestamp like dateInZone', () => {
    expect(() => hourInZone('yesterday', 'UTC')).toThrow(RangeError);
  });
});

describe('dateOfTimestampInZone', () => {
  it('reads device timestamps', () => {
    expect(dateOfTimestampInZone('2026-03-10T23:30:00.000Z', 'Asia/Tehran')).toBe('2026-03-11');
    expect(dateOfTimestampInZone('2026-03-10T23:30:00.000Z', 'America/New_York')).toBe(
      '2026-03-10',
    );
  });

  it('reads Postgres timestamps, with a space, 6 decimals and an offset', () => {
    expect(dateOfTimestampInZone('2026-03-10 23:30:00.123456+00:00', 'Asia/Tehran')).toBe(
      '2026-03-11',
    );
    expect(dateOfTimestampInZone('2026-03-10 23:30:00+0000', 'UTC')).toBe('2026-03-10');
    expect(dateOfTimestampInZone('2026-03-10T23:30+01', 'UTC')).toBe('2026-03-10');
    expect(dateOfTimestampInZone('2026-03-10T23:30:00+05:30', 'UTC')).toBe('2026-03-10');
  });

  it('falls back to the first ten characters for text it cannot read', () => {
    expect(dateOfTimestampInZone('2026-03-10 nonsense', 'UTC')).toBe('2026-03-10');
    expect(dateOfTimestampInZone('2026-13-45T10:00:00Z', 'UTC')).toBe('2026-13-45');
  });
});
