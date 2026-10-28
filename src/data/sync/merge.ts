/**
 * The merge rules (ADR-003, ADR-013). Pure, so every case is tested.
 */

import type { EntryKind, EntryRow } from '../db';

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Milliseconds of a timestamp from the device ("…T08:15:00.000Z") or from Postgres
 * ("…T08:15:00.123456+00:00", 6 decimals). Safari is strict about odd formats, so we
 * rewrite to plain ISO (3 decimals, Z or ±hh:mm) before parsing. Throws on garbage.
 */
export function timeMs(timestamp: string): number {
  const match = TIMESTAMP.exec(timestamp);
  const ms = match
    ? Date.parse(`${match[1]}T${match[2]}${(match[3] ?? '').slice(0, 4)}${normalizeZone(match[4])}`)
    : NaN;
  if (Number.isNaN(ms)) throw new RangeError(`Not a timestamp: "${timestamp}"`);
  return ms;
}

function normalizeZone(zone: string | undefined): string {
  if (!zone || zone === 'Z') return 'Z';
  const digits = zone.replace(':', '');
  return `${digits.slice(0, 3)}:${digits.slice(3, 5).padEnd(2, '0')}`;
}

/**
 * Last write wins: the cloud copy replaces the device copy only when it is strictly newer.
 * Same time → keep the device copy (it is the same edit, or the device's own pending one).
 * Timestamps are UTC ISO strings, compared as moments.
 */
export function remoteWins(
  local: { updatedAt: string } | undefined,
  remote: { updatedAt: string },
) {
  return local === undefined || timeMs(remote.updatedAt) > timeMs(local.updatedAt);
}

/** Review logs are append-only: a cloud log is added only if the device doesn't have it. */
export function shouldAddLog(local: unknown): boolean {
  return local === undefined;
}

const sameText = (text: string) => text.trim().toLocaleLowerCase();

export interface EntryMergePlan {
  /** Device entries that move to the cloud card, with their new position. */
  move: { entry: EntryRow; position: number }[];
  /** Device entries already on the cloud card (same kind and text): dropped. */
  drop: EntryRow[];
}

/**
 * The same word was added on two devices while offline (Yali's decision, 2026-10-28):
 * combine the lists into the cloud card without repeats; moved items go after the cloud's own.
 */
export function planEntryMerge(
  cloud: readonly EntryRow[],
  device: readonly EntryRow[],
): EntryMergePlan {
  const live = cloud.filter((e) => e.deletedAt === null);
  const seen = new Set(live.map((e) => `${e.kind}:${sameText(e.text)}`));
  const next: Record<EntryKind, number> = { synonym: 0, meaning: 0, sentence: 0 };
  for (const e of live) next[e.kind] = Math.max(next[e.kind], e.position + 1);

  const plan: EntryMergePlan = { move: [], drop: [] };
  const ordered = device
    .filter((e) => e.deletedAt === null)
    .sort((a, b) => a.position - b.position);
  for (const entry of ordered) {
    const key = `${entry.kind}:${sameText(entry.text)}`;
    if (seen.has(key)) {
      plan.drop.push(entry);
    } else {
      seen.add(key);
      plan.move.push({ entry, position: next[entry.kind]++ });
    }
  }
  return plan;
}
