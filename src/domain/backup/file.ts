/**
 * The backup file (roadmap 7.12, ADR-016): everything in one account's box as JSON, so the
 * words survive a long time offline even if the phone loses the app's data.
 * Pure: reading a file checks every row, so a wrong or damaged file is refused before
 * anything is saved.
 */

import type { Box, DeckId } from '../leitner/config';
import { DECK_IDS } from '../leitner/config';
import { assertCalendarDate, type CalendarDate } from '../time/calendarDate';
import { dateInZone, dateOfTimestampInZone } from '../time/zonedDate';

export const BACKUP_APP = 'leitner-backup';
/**
 * Version 2 (v3 decks) adds card.deck, card.addedOn and log.typedAnswer; version 3 adds
 * entry.translation (sentence translations). Version 1 and 2 files still restore.
 */
export const BACKUP_VERSION = 3;

export interface BackupCard {
  id: string;
  word: string;
  deck: DeckId;
  addedOn: CalendarDate;
  box: Box;
  dueDate: CalendarDate;
  masteredAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BackupEntry {
  id: string;
  cardId: string;
  kind: 'synonym' | 'meaning' | 'sentence';
  text: string;
  /** Sentences only; null for none. */
  translation: string | null;
  position: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BackupLog {
  id: string;
  cardId: string;
  reviewedAt: string;
  correct: boolean;
  boxBefore: Box;
  boxAfter: Box | null;
  isPractice: boolean;
  typedAnswer: string | null;
  createdAt: string;
}

export interface BackupStreakDay {
  day: CalendarDate;
  id: string;
  createdAt: string;
}

export interface BackupProfile {
  displayName: string | null;
  timeZone: string;
}

export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  /** UTC ISO timestamp. */
  exportedAt: string;
  /** The account it came from: a backup only goes back into that account. */
  userId: string;
  profile: BackupProfile | null;
  cards: BackupCard[];
  entries: BackupEntry[];
  reviewLogs: BackupLog[];
  streakDays: BackupStreakDay[];
}

export type BackupProblem =
  /** Not JSON, or JSON from something else. */
  | 'notABackup'
  /** Made by a newer version of the app. */
  | 'newerVersion'
  /** Looks like a backup, but a row is missing or broken. */
  | 'damaged';

export type ReadBackup = { ok: true; backup: Backup } | { ok: false; problem: BackupProblem };

// ---------- Row checks ----------

type Check = (value: unknown) => boolean;
type Schema = Record<string, Check>;

const text: Check = (v) => typeof v === 'string';
const id: Check = (v) => typeof v === 'string' && v.length > 0;
const flag: Check = (v) => typeof v === 'boolean';
const whole: Check = (v) => Number.isInteger(v) && (v as number) >= 0;
const box: Check = (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
/** Device ("…T08:00:00.000Z") and cloud ("… 08:00:00.123456+00:00") timestamps. Not parsed: Safari is strict. */
const timestamp: Check = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v);
const calendarDate: Check = (v) => {
  if (typeof v !== 'string') return false;
  try {
    assertCalendarDate(v);
    return true;
  } catch {
    return false;
  }
};
const nullable =
  (check: Check): Check =>
  (v) =>
    v === null || check(v);
const oneOf =
  (...values: string[]): Check =>
  (v) =>
    values.includes(v as string);

const CARD: Schema = {
  id,
  word: id,
  deck: oneOf(...DECK_IDS),
  addedOn: calendarDate,
  box,
  dueDate: calendarDate,
  masteredAt: nullable(timestamp),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: nullable(timestamp),
};
const ENTRY: Schema = {
  id,
  cardId: id,
  kind: oneOf('synonym', 'meaning', 'sentence'),
  text: id,
  translation: nullable(id),
  position: whole,
  updatedAt: timestamp,
  deletedAt: nullable(timestamp),
};
const LOG: Schema = {
  id,
  cardId: id,
  reviewedAt: timestamp,
  correct: flag,
  boxBefore: box,
  boxAfter: nullable(box),
  isPractice: flag,
  typedAnswer: nullable(text),
  createdAt: timestamp,
};
const STREAK_DAY: Schema = { day: calendarDate, id, createdAt: timestamp };
const PROFILE: Schema = { displayName: nullable(text), timeZone: id };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The row with only the schema's fields, or null when one is missing or wrong. */
function pick(raw: unknown, schema: Schema): Record<string, unknown> | null {
  if (!isObject(raw)) return null;
  const row: Record<string, unknown> = {};
  for (const [key, check] of Object.entries(schema)) {
    if (!check(raw[key])) return null;
    row[key] = raw[key];
  }
  return row;
}

function pickAll(raw: unknown, schema: Schema): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw.map((item) => pick(item, schema));
  return rows.every((row) => row !== null) ? (rows as Record<string, unknown>[]) : null;
}

// ---------- Reading and naming ----------

/** Version 1 cards → version 2 shape. Rows that aren't objects are left for the checks to refuse. */
function upgradeCardsV1(raw: unknown, zone: string): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((card) => {
    if (!isObject(card)) return card;
    const addedOn =
      typeof card.createdAt === 'string' && timestamp(card.createdAt)
        ? dateOfTimestampInZone(card.createdAt, zone)
        : undefined; // refused as damaged below
    return { ...card, deck: 'vocab', addedOn };
  });
}

function withoutTranslations(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((entry) => (isObject(entry) ? { ...entry, translation: null } : entry));
}

function upgradeLogsV1(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((log) => (isObject(log) ? { ...log, typedAnswer: null } : log));
}

/** Reads a backup file's text. Unknown extra fields are dropped. */
export function readBackup(fileText: string): ReadBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(fileText);
  } catch {
    return { ok: false, problem: 'notABackup' };
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP) return { ok: false, problem: 'notABackup' };
  if (typeof raw.version === 'number' && raw.version > BACKUP_VERSION) {
    return { ok: false, problem: 'newerVersion' };
  }

  const isV1 = raw.version === 1;
  // Version 1 has no decks: every card is vocab, added on the day it was created (profile time zone).
  const zone =
    isObject(raw.profile) && typeof raw.profile.timeZone === 'string' && raw.profile.timeZone
      ? raw.profile.timeZone
      : 'UTC';
  const cards = pickAll(isV1 ? upgradeCardsV1(raw.cards, zone) : raw.cards, CARD) as
    BackupCard[] | null;
  const isV2 = raw.version === 2;
  // Versions 1 and 2 have no translations: every entry gets none.
  const entries = pickAll(isV1 || isV2 ? withoutTranslations(raw.entries) : raw.entries, ENTRY) as
    BackupEntry[] | null;
  const reviewLogs = pickAll(isV1 ? upgradeLogsV1(raw.reviewLogs) : raw.reviewLogs, LOG) as
    BackupLog[] | null;
  const streakDays = pickAll(raw.streakDays, STREAK_DAY) as BackupStreakDay[] | null;
  const profile =
    raw.profile === null ? null : (pick(raw.profile, PROFILE) as BackupProfile | null);
  if (
    (raw.version !== BACKUP_VERSION && !isV1 && !isV2) ||
    !timestamp(raw.exportedAt) ||
    !id(raw.userId) ||
    !cards ||
    !entries ||
    !reviewLogs ||
    !streakDays ||
    (profile === null && raw.profile !== null)
  ) {
    return { ok: false, problem: 'damaged' };
  }

  // Every list item and review needs its card in the file (the cloud refuses them otherwise).
  const cardIds = new Set(cards.map((card) => card.id));
  if (![...entries, ...reviewLogs].every((row) => cardIds.has(row.cardId))) {
    return { ok: false, problem: 'damaged' };
  }

  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: raw.exportedAt as string,
      userId: raw.userId as string,
      profile,
      cards,
      entries,
      reviewLogs,
      streakDays,
    },
  };
}

/** Words in the backup that aren't deleted (for "This backup has 120 words"). */
export function wordCount(backup: Backup): number {
  return backup.cards.filter((card) => card.deletedAt === null).length;
}

/** "leitner-backup-2026-10-29.json", dated in the profile time zone. */
export function backupFileName(exportedAt: string, timeZone: string): string {
  return `leitner-backup-${dateInZone(exportedAt, timeZone)}.json`;
}
