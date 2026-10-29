/**
 * "Which calendar date is it in the profile time zone?" (PRD "Time and offline").
 * The phone's own time-zone setting is never used: the zone is always passed in.
 * Uses the browser's built-in Intl time-zone data, so it works offline.
 */

import { assertCalendarDate, type CalendarDate } from './calendarDate';

/** Used when a profile's time zone is missing or not a real zone (Yali's decision, 2026-10-28; matches the DB default). */
export const FALLBACK_TIME_ZONE = 'UTC';

/** A UTC ISO timestamp, e.g. "2026-03-10T08:15:00.000Z". */
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

const formatters = new Map<string, Intl.DateTimeFormat>();
const hourFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws RangeError for an unknown zone.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True for a real IANA zone name such as "Asia/Tehran" or "America/New_York". */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The profile's zone if it is real, otherwise UTC. Never the phone's zone. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

/**
 * The calendar date of a UTC moment in `timeZone`.
 * "Today" is `dateInZone(now, profileTimeZone)`; the same works for past review times.
 */
export function dateInZone(instant: string, timeZone: string): CalendarDate {
  const ms = Date.parse(instant);
  if (!UTC_INSTANT.test(instant) || Number.isNaN(ms)) {
    throw new RangeError(`Not a UTC ISO timestamp: "${instant}"`);
  }
  // Date.parse quietly rolls over impossible dates (Feb 30 → Mar 2); reject them instead.
  assertCalendarDate(instant.slice(0, 10));

  const parts = formatterFor(timeZone).formatToParts(new Date(ms));
  const part = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

/** The hour (0–23) of a UTC moment in `timeZone`, e.g. for "is it 19:00 there yet?". */
export function hourInZone(instant: string, timeZone: string): number {
  // Same checks as dateInZone (throws on a bad timestamp or zone).
  dateInZone(instant, timeZone);
  let formatter = hourFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
      numberingSystem: 'latn',
    });
    hourFormatters.set(timeZone, formatter);
  }
  return Number(formatter.format(new Date(Date.parse(instant))));
}
