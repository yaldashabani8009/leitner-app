import { describe, expect, it } from 'vitest';
import { DECKS } from '../decks/decks';
import {
  isStillTimely,
  minutesOf,
  reminderMessage,
  roundToStep,
  TEST_MESSAGE,
  waitingAcrossDecks,
  type DeckDay,
} from './reminder';

const vocab = (due: number, reviewsToday = 0): DeckDay => ({ deck: 'vocab', due, reviewsToday });
const facts = (decks: DeckDay[], over: { earnedToday?: boolean; streak?: number } = {}) => ({
  decks,
  earnedToday: false,
  streak: 0,
  ...over,
});

describe('waitingAcrossDecks', () => {
  it('adds up every deck, each within its own daily limit', () => {
    expect(
      waitingAcrossDecks([
        vocab(20, 90), // 10 left under 100
        { deck: 'spelling', due: 40, reviewsToday: 0 },
        { deck: 'phrases', due: 50, reviewsToday: 25 }, // 5 left under 30
      ]),
    ).toBe(55);
  });
});

describe('reminderMessage (v3 brief 1.11)', () => {
  it('cards waiting, counted across decks, naming the deck with the most', () => {
    expect(
      reminderMessage(facts([vocab(8), { deck: 'spelling', due: 12, reviewsToday: 0 }]), DECKS),
    ).toEqual({
      title: 'Time for your words',
      body: '20 cards waiting · mostly spelling',
      badge: 20,
    });
  });

  it('one enabled deck: no deck name; one card in the singular', () => {
    expect(reminderMessage(facts([vocab(1)]))).toEqual({
      title: 'Time for your words',
      body: '1 card waiting',
      badge: 1,
    });
  });

  it('nothing due: the streak saver, with or without a streak', () => {
    expect(reminderMessage(facts([vocab(0)], { streak: 4 }))?.body).toBe(
      'Add a word to keep your 4-day streak.',
    );
    expect(reminderMessage(facts([vocab(0)]))?.body).toBe(
      'Add a new word today and start a streak.',
    );
  });

  it('no reminder when the day is earned or every daily limit is reached', () => {
    expect(reminderMessage(facts([vocab(5)], { earnedToday: true }))).toBeNull();
    expect(reminderMessage(facts([vocab(5, 100)]))).toBeNull();
  });

  it('the test message names no fixed hour', () => {
    expect(TEST_MESSAGE.body).toContain('your reminder time');
  });
});

describe('isStillTimely', () => {
  it('sends up to 4 hours late, not later', () => {
    const at = '2026-10-31T15:30:00.000Z';
    expect(isStillTimely(at, '2026-10-31T15:30:00.000Z')).toBe(true);
    expect(isStillTimely(at, '2026-10-31T19:30:00.000Z')).toBe(true);
    expect(isStillTimely(at, '2026-10-31T19:31:00.000Z')).toBe(false);
  });
});

describe('time picker steps', () => {
  it('reads and rounds times to 15 minutes', () => {
    expect(minutesOf('19:00')).toBe(1140);
    expect(roundToStep('19:07', 15)).toBe('19:00');
    expect(roundToStep('19:08', 15)).toBe('19:15');
    expect(roundToStep('23:55', 15)).toBe('00:00');
  });
});
