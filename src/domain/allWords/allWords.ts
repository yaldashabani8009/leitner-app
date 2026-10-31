/**
 * The all-words page (v3 brief 1.9, canvas N8–N10, L4): search, the three sorts, day headings
 * and the progress-dot labels. Pure: the caller passes the rows and "today".
 */

import { BOX_COUNT, type Box, type DeckId } from '../leitner/config';
import { addDays, type CalendarDate } from '../time/calendarDate';

export interface WordRow {
  readonly id: string;
  readonly word: string;
  readonly deck: DeckId;
  readonly box: Box;
  readonly mastered: boolean;
  /** Day added (or re-added), in the profile time zone. */
  readonly addedOn: CalendarDate;
  /** UTC ISO timestamp; orders cards added on the same day. */
  readonly createdAt: string;
  /** Persian meanings, in order. */
  readonly meanings: readonly string[];
  /** "Not yet" answers in real reviews (practice never counts). */
  readonly misses: number;
}

export type WordSort = 'day' | 'az' | 'needsWork';

/**
 * Text for matching: lower case, Arabic ي and ك as Persian ی and ک, no half-space (ZWNJ),
 * single spaces. So "میخواهم" finds "می‌خواهم" and "كتاب" finds "کتاب".
 */
export function normalizeForSearch(text: string): string {
  return text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/‌/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does the row match what was typed? The word and its Persian meanings count. */
export function matchesSearch(row: WordRow, query: string): boolean {
  const wanted = normalizeForSearch(query);
  if (wanted === '') return true;
  return [row.word, ...row.meanings].some((text) => normalizeForSearch(text).includes(wanted));
}

const byWord = (a: WordRow, b: WordRow) =>
  a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

/**
 * - day: newest first (by day added, then by time);
 * - az: A–Z, ignoring capitals;
 * - needsWork: most "Not yet" answers first, ties by lowest box (mastered last), then A–Z.
 */
export function sortRows(rows: readonly WordRow[], sort: WordSort): WordRow[] {
  const out = [...rows];
  if (sort === 'az') return out.sort(byWord);
  if (sort === 'needsWork') {
    const level = (row: WordRow) => (row.mastered ? BOX_COUNT + 1 : row.box);
    return out.sort((a, b) => b.misses - a.misses || level(a) - level(b) || byWord(a, b));
  }
  return out.sort((a, b) =>
    a.addedOn !== b.addedOn
      ? a.addedOn < b.addedOn
        ? 1
        : -1
      : a.createdAt !== b.createdAt
        ? a.createdAt < b.createdAt
          ? 1
          : -1
        : a.id.localeCompare(b.id),
  );
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "TODAY", "YESTERDAY", "14 SEP", or "14 SEP 2025" for another year. */
export function dayHeading(day: CalendarDate, today: CalendarDate): string {
  if (day === today) return 'TODAY';
  if (day === addDays(today, -1)) return 'YESTERDAY';
  const [year, month, date] = day.split('-');
  const label = `${Number(date)} ${MONTHS[Number(month) - 1]}`;
  return year === today.slice(0, 4) ? label : `${label} ${year}`;
}

export type ListItem =
  { kind: 'heading'; day: CalendarDate; label: string } | { kind: 'row'; row: WordRow };

/** The list as drawn: with day headings for "By day", without for the other sorts. */
export function listItems(
  rows: readonly WordRow[],
  sort: WordSort,
  today: CalendarDate,
): ListItem[] {
  const sorted = sortRows(rows, sort);
  if (sort !== 'day') return sorted.map((row) => ({ kind: 'row', row }));
  const items: ListItem[] = [];
  let day: string | null = null;
  for (const row of sorted) {
    if (row.addedOn !== day) {
      day = row.addedOn;
      items.push({ kind: 'heading', day, label: dayHeading(day, today) });
    }
    items.push({ kind: 'row', row });
  }
  return items;
}

/** Spoken label of the progress dots: "Box 3 of 5" or "Mastered". */
export function progressLabel(row: Pick<WordRow, 'box' | 'mastered'>): string {
  return row.mastered ? 'Mastered' : `Box ${row.box} of ${BOX_COUNT}`;
}
