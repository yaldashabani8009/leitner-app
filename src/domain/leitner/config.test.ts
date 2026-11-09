import { describe, expect, it } from 'vitest';
import {
  BOX_COUNT,
  BOX_GAPS_DAYS,
  DAILY_REVIEW_CAP,
  DECK_MISS_RULE,
  SESSION_SIZE,
  gapForBox,
} from './config';

describe('leitner config', () => {
  it('has one gap per box, doubling from 1 day', () => {
    expect(BOX_GAPS_DAYS).toHaveLength(BOX_COUNT);
    expect(BOX_GAPS_DAYS).toEqual([1, 2, 4, 8, 16]);
  });

  it('maps box numbers to gaps', () => {
    expect(gapForBox(1)).toBe(1);
    expect(gapForBox(5)).toBe(16);
  });

  it('allows exactly five sessions under the daily cap', () => {
    expect(DAILY_REVIEW_CAP / SESSION_SIZE).toBe(5);
  });
});

describe('miss rule per deck (ADR-022)', () => {
  it('vocab and spelling reset; phrases step back', () => {
    expect(DECK_MISS_RULE).toEqual({ vocab: 'reset', spelling: 'reset', phrases: 'stepBack' });
  });
});
