import { describe, expect, it } from 'vitest';
import { isReminderTime, reminderMessage, waitingToday, type ReminderFacts } from './reminder';

describe('isReminderTime (from 19:00 in the profile zone, once a day)', () => {
  // 15:30 UTC = 19:00 in Tehran (UTC+3:30).
  const tehran = (utc: string, lastRemindedOn: string | null = null) =>
    isReminderTime({ now: utc, timeZone: 'Asia/Tehran', lastRemindedOn });

  it('not before 19:00 local time', () => {
    expect(tehran('2026-10-29T15:29:00.000Z')).toBe(false);
  });

  it('from 19:00 local time', () => {
    expect(tehran('2026-10-29T15:30:00.000Z')).toBe(true);
    expect(tehran('2026-10-29T18:00:00.000Z')).toBe(true); // 21:30
  });

  it('not from 23:00 (the evening was missed)', () => {
    expect(tehran('2026-10-29T19:30:00.000Z')).toBe(false); // 23:00
  });

  it('only once a local day', () => {
    expect(tehran('2026-10-29T16:00:00.000Z', '2026-10-29')).toBe(false);
    expect(tehran('2026-10-29T16:00:00.000Z', '2026-10-28')).toBe(true);
  });

  it('follows the profile zone, not UTC', () => {
    // 19:30 in New York is already the next day in UTC.
    const nyc = { now: '2026-10-29T23:30:00.000Z', timeZone: 'America/New_York' };
    expect(isReminderTime({ ...nyc, lastRemindedOn: '2026-10-28' })).toBe(true);
    expect(isReminderTime({ ...nyc, lastRemindedOn: '2026-10-29' })).toBe(false);
  });
});

describe('waitingToday (the number on the app icon)', () => {
  it('is the due words, but never past the daily cap', () => {
    expect(waitingToday(12, 0)).toBe(12);
    expect(waitingToday(150, 90)).toBe(10);
    expect(waitingToday(40, 100)).toBe(0);
    expect(waitingToday(40, 130)).toBe(0);
    expect(waitingToday(0, 0)).toBe(0);
  });
});

describe('reminderMessage', () => {
  const facts = (f: Partial<ReminderFacts>): ReminderFacts => ({
    dueCount: 0,
    reviewsToday: 0,
    earnedToday: false,
    streak: 0,
    ...f,
  });

  it('nothing when today already counts for the streak', () => {
    expect(reminderMessage(facts({ earnedToday: true, dueCount: 5 }))).toBeNull();
  });

  it('words waiting, with the number on the app icon', () => {
    expect(reminderMessage(facts({ dueCount: 12 }))).toEqual({
      title: 'Time for your words',
      body: '12 words are waiting for you.',
      badge: 12,
    });
    expect(reminderMessage(facts({ dueCount: 1 }))?.body).toBe('1 word is waiting for you.');
  });

  it('never more than the daily cap allows', () => {
    expect(reminderMessage(facts({ dueCount: 150, reviewsToday: 90 }))?.badge).toBe(10);
  });

  it('nothing once the daily cap is reached', () => {
    expect(reminderMessage(facts({ dueCount: 40, reviewsToday: 100 }))).toBeNull();
    expect(reminderMessage(facts({ dueCount: 40, reviewsToday: 120 }))).toBeNull();
  });

  it('nothing due: a nudge to add a word for the streak', () => {
    expect(reminderMessage(facts({ streak: 5 }))).toEqual({
      title: 'Keep your streak going',
      body: 'Add a word to keep your 5-day streak.',
      badge: 0,
    });
    expect(reminderMessage(facts({}))?.body).toBe('Add a new word today and start a streak.');
  });
});
