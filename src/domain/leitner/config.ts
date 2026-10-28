/**
 * Leitner configuration. The ONE place the schedule numbers live (PRD: "gaps live in one config value").
 * The engine itself (step 7) is a pure module in this folder: no React, no Dexie, no Supabase imports.
 */

export const BOX_COUNT = 5;

/** Days until the next review once a card has moved INTO this box. Index 0 = box 1. */
export const BOX_GAPS_DAYS = [1, 2, 4, 8, 16] as const;

export const SESSION_SIZE = 20;
export const DAILY_REVIEW_CAP = 100;

export type Box = 1 | 2 | 3 | 4 | 5;

export function gapForBox(box: Box): number {
  return BOX_GAPS_DAYS[box - 1];
}

/** Scheduled reviews in one day that always earn a streak day (Yali's decision, 2026-10-28). */
export const STREAK_DAILY_REVIEWS = 20;
