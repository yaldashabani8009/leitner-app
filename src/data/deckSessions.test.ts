import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardDraft } from '../domain/card/validate';
import type { DeckId } from '../domain/leitner/config';
import { currentStep } from '../domain/session/session';
import { LeitnerDb } from './db';
import { createRepository, type Repository } from './repository';

const DAY_1 = '2026-03-10T08:00:00.000Z';
const DAY_2 = '2026-03-11T08:00:00.000Z';
const ALL: DeckId[] = ['vocab', 'spelling', 'phrases'];

let db: LeitnerDb;
let repo: Repository;
let now: string;

const draft = (word: string): CardDraft => ({
  word,
  synonyms: [{ text: 'x' }],
  meanings: [{ text: 'ی' }],
  sentences: [{ text: `A ${word}.` }],
});

beforeEach(async () => {
  db = new LeitnerDb(`decks-${crypto.randomUUID()}`);
  now = DAY_1;
  repo = createRepository(db, { now: () => now, newId: () => crypto.randomUUID() });
  await repo.saveProfile({ userId: 'u1', displayName: 'Yali', timeZone: 'UTC', updatedAt: now });
});

afterEach(async () => {
  await db.delete();
});

async function add(deck: DeckId, ...words: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const word of words) {
    const result = await repo.addCard(draft(word), deck);
    if (result.status !== 'created') throw new Error(result.status);
    ids.push(result.cardId);
  }
  return ids;
}

describe('deckStatuses (Today screen, v3 brief 1.4)', () => {
  it('empty, added today, waiting, done', async () => {
    await add('vocab', 'brave', 'calm');
    await add('spelling', 'receive');
    expect(await repo.deckStatuses(ALL)).toEqual([
      { deck: 'vocab', cardCount: 2, waiting: 0, pausedLeft: null, addedToday: 2 },
      { deck: 'spelling', cardCount: 1, waiting: 0, pausedLeft: null, addedToday: 1 },
      { deck: 'phrases', cardCount: 0, waiting: 0, pausedLeft: null, addedToday: 0 },
    ]);
    now = DAY_2;
    expect(await repo.deckStatuses(ALL)).toMatchObject([
      { deck: 'vocab', waiting: 2, addedToday: 0 },
      { deck: 'spelling', waiting: 1 },
      { deck: 'phrases', waiting: 0, cardCount: 0 },
    ]);
  });

  it('a session left half way says how many are left, practice round included', async () => {
    await add('vocab', 'a', 'b', 'c');
    now = DAY_2;
    const session = (await repo.openDeckSession('vocab'))!;
    const first = currentStep(session)!.cardId;
    await repo.recordAnswer(first, false, 'scheduled'); // missed: 2 left + 1 practice
    const [vocab] = await repo.deckStatuses(['vocab']);
    expect(vocab).toMatchObject({ pausedLeft: 3, waiting: 2 });
  });

  it('a session started but not answered yet is not "paused"', async () => {
    await add('vocab', 'a');
    now = DAY_2;
    await repo.openDeckSession('vocab');
    expect((await repo.deckStatuses(['vocab']))[0].pausedLeft).toBeNull();
  });

  it('a session from yesterday is forgotten', async () => {
    await add('vocab', 'a', 'b');
    now = DAY_2;
    const session = (await repo.openDeckSession('vocab'))!;
    await repo.recordAnswer(currentStep(session)!.cardId, true, 'scheduled');
    now = '2026-03-12T08:00:00.000Z';
    expect((await repo.deckStatuses(['vocab']))[0].pausedLeft).toBeNull();
  });

  it('counts the daily limit per deck', async () => {
    await add('phrases', ...Array.from({ length: 35 }, (_, i) => `p${i}`));
    now = DAY_2;
    expect((await repo.deckStatuses(['phrases']))[0].waiting).toBe(30);
  });
});

describe('openDeckSession / closeDeckSession (v3 brief 1.6)', () => {
  it('picks the deck’s own cards, at most its session size', async () => {
    await add('vocab', ...Array.from({ length: 25 }, (_, i) => `v${i}`));
    const spelling = await add('spelling', 'receive');
    now = DAY_2;
    const vocab = (await repo.openDeckSession('vocab'))!;
    expect(vocab.scheduled).toHaveLength(20);
    expect(vocab.scheduled).not.toContain(spelling[0]);
    expect((await repo.openDeckSession('spelling'))!.scheduled).toEqual(spelling);
  });

  it('nothing due → null', async () => {
    await add('vocab', 'a');
    expect(await repo.openDeckSession('vocab')).toBeNull();
    expect(await repo.openDeckSession('phrases')).toBeNull();
  });

  it('Continue carries on where it stopped, with the practice round, after another deck', async () => {
    await add('vocab', 'a', 'b');
    await add('spelling', 's');
    now = DAY_2;
    const first = (await repo.openDeckSession('vocab'))!;
    const missed = currentStep(first)!.cardId;
    await repo.recordAnswer(missed, false, 'scheduled');
    // Study another deck in between.
    const spelling = (await repo.openDeckSession('spelling'))!;
    await repo.recordAnswer(currentStep(spelling)!.cardId, true, 'scheduled');

    const again = (await repo.openDeckSession('vocab'))!;
    expect(again.scheduled).toEqual(first.scheduled);
    expect(again.answered).toBe(1);
    const second = currentStep(again)!;
    expect(second.kind).toBe('scheduled');
    await repo.recordAnswer(second.cardId, true, 'scheduled');
    expect(currentStep((await repo.openDeckSession('vocab'))!)).toEqual({
      cardId: missed,
      kind: 'practice',
    });
  });

  it('after closing, the next open picks fresh cards (none left today)', async () => {
    await add('vocab', 'a');
    now = DAY_2;
    const session = (await repo.openDeckSession('vocab'))!;
    await repo.recordAnswer(currentStep(session)!.cardId, true, 'scheduled');
    await repo.closeDeckSession('vocab');
    expect(await repo.openDeckSession('vocab')).toBeNull();
  });

  it('a finished session is not reused: a fresh one is picked', async () => {
    await add('vocab', 'a', 'b');
    now = DAY_2;
    const session = (await repo.openDeckSession('vocab'))!;
    for (const id of session.scheduled) await repo.recordAnswer(id, true, 'scheduled');
    expect(await repo.openDeckSession('vocab')).toBeNull();
  });
});

describe('openMixSession (v3 brief 1.5)', () => {
  const steady = () => 0.5;

  it('mixes each deck’s real session, with each card’s deck', async () => {
    const vocab = await add('vocab', ...Array.from({ length: 25 }, (_, i) => `v${i}`));
    const spelling = await add('spelling', 's1', 's2', 's3', 's4');
    await add('phrases', 'p1');
    now = DAY_2;
    const mix = (await repo.openMixSession(['vocab', 'spelling'], steady))!;
    // Vocab's session size (20) still applies; phrases weren't asked for.
    expect(mix.session.scheduled).toHaveLength(24);
    expect(mix.session.scheduled.filter((id) => vocab.includes(id))).toHaveLength(20);
    expect(mix.session.scheduled.filter((id) => spelling.includes(id))).toHaveLength(4);
    expect(new Set(Object.values(mix.deckOf))).toEqual(new Set(['vocab', 'spelling']));
    // Mixed: the decks take turns in chunks.
    const decks = mix.session.scheduled.map((id) => mix.deckOf[id]);
    expect(decks.slice(0, 3).every((deck) => deck === decks[0])).toBe(true);
    expect(new Set(decks.slice(0, 15)).size).toBe(2);
  });

  it('answers move boxes; leaving and coming back carries on, practice round at the end', async () => {
    await add('vocab', 'a', 'b');
    await add('spelling', 's');
    now = DAY_2;
    const first = (await repo.openMixSession(['vocab', 'spelling'], steady))!;
    const missed = currentStep(first.session)!.cardId;
    await repo.recordAnswer(missed, false, 'scheduled');
    const again = (await repo.openMixSession(['vocab', 'spelling'], () => 0.1))!;
    expect(again.session.scheduled).toEqual(first.session.scheduled);
    expect(again.session).toMatchObject({ answered: 1, practice: [missed] });
    expect((await db.cards.get(missed))?.box).toBe(1);
  });

  it('respects each deck’s daily limit', async () => {
    await add('phrases', ...Array.from({ length: 12 }, (_, i) => `p${i}`));
    now = DAY_2;
    // 25 phrases reviewed earlier today: only 5 more fit under the limit of 30.
    for (let i = 0; i < 25; i++) {
      await db.reviewLogs.add({
        id: `old${i}`,
        cardId: (await db.cards.toCollection().first())!.id,
        reviewedAt: '2026-03-11T07:00:00.000Z',
        correct: true,
        boxBefore: 1,
        boxAfter: 2,
        isPractice: false,
        createdAt: '2026-03-11T07:00:00.000Z',
      });
    }
    const mix = (await repo.openMixSession(['phrases'], steady))!;
    expect(mix.session.scheduled).toHaveLength(5);
  });

  it('nothing due anywhere → null; a finished mix is closed', async () => {
    await add('vocab', 'a');
    expect(await repo.openMixSession(['vocab'], steady)).toBeNull();
    now = DAY_2;
    const mix = (await repo.openMixSession(['vocab'], steady))!;
    await repo.recordAnswer(mix.session.scheduled[0], true, 'scheduled');
    await repo.closeMixSession();
    expect(await repo.openMixSession(['vocab'], steady)).toBeNull();
  });

  it('a card deleted mid-mix has no deck', async () => {
    const [a] = await add('vocab', 'a', 'b');
    now = DAY_2;
    await repo.openMixSession(['vocab'], steady);
    await db.cards.delete(a);
    const again = (await repo.openMixSession(['vocab'], steady))!;
    expect(again.deckOf[a]).toBeUndefined();
  });
});

describe('mixPausedLeft', () => {
  it('counts what is left of a mix left half way today, and forgets it tomorrow', async () => {
    await add('vocab', 'a', 'b');
    now = DAY_2;
    expect(await repo.mixPausedLeft()).toBeNull();
    const mix = (await repo.openMixSession(['vocab'], () => 0.5))!;
    expect(await repo.mixPausedLeft()).toBeNull(); // opened, nothing answered yet
    await repo.recordAnswer(mix.session.scheduled[0], false, 'scheduled');
    expect(await repo.mixPausedLeft()).toBe(2); // one more card + one practice
    now = '2026-03-12T08:00:00.000Z';
    expect(await repo.mixPausedLeft()).toBeNull();
  });
});
