/**
 * Calendar dates ("2026-03-10") with no time and no time zone.
 * Due dates are calendar dates in the profile time zone (PRD "Time and offline"),
 * so adding days is plain calendar maths. Working out *which* date is "today" in
 * the profile time zone is a separate helper (roadmap 7.2).
 */

/** A calendar date written as YYYY-MM-DD, e.g. "2026-03-10". */
export type CalendarDate = string;

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds at UTC midnight of the date. Throws on anything that isn't a real date. */
function toUtcMs(date: CalendarDate): number {
  const match = PATTERN.exec(date);
  if (!match) throw new RangeError(`Not a calendar date (YYYY-MM-DD): "${date}"`);

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // Date.UTC quietly rolls over impossible dates (Feb 30 → Mar 2); reject them instead.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`Not a real calendar date: "${date}"`);
  }
  return ms;
}

/** Throws unless `date` is a real YYYY-MM-DD calendar date. */
export function assertCalendarDate(date: CalendarDate): void {
  toUtcMs(date);
}

/** The date `days` days after `date` (negative goes back). */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  if (!Number.isInteger(days)) throw new RangeError(`Days must be a whole number: ${days}`);
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** True when `a` is the same day as `b` or earlier. */
export function isOnOrBefore(a: CalendarDate, b: CalendarDate): boolean {
  return toUtcMs(a) <= toUtcMs(b);
}
