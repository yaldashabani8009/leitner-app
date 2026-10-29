import 'fake-indexeddb/auto';
import { liveQuery } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardDraft } from '../domain/card/validate';
import { databaseNameFor, LeitnerDb, openDatabase } from './db';
import { createRepository, type Repository } from './repository';

const items = (...texts: string[]) => texts.map((text) => ({ text }));
const draft = (word = 'brave'): CardDraft => ({
  word,
  synonyms: items('bold', 'daring'),
  meanings: items('شجاع'),
  sentences: items('She was brave.'),
});

let db: LeitnerDb;
let repo: Repository;
let now: string;
let idCount: number;
let failOnId: number | null;

beforeEach(async () => {
  db = new LeitnerDb(`test-${crypto.randomUUID()}`);
  now = '2026-03-10T08:00:00.000Z'; // 11:30 on the 10th in Tehran
  idCount = 0;
  failOnId = null;
  repo = createRepository(db, {
    now: () => now,
    newId: () => {
      idCount += 1;
      if (idCount === failOnId) throw new Error('boom');
      return `id-${idCount}`;
    },
  });
  await repo.saveProfile({
    userId: 'u1',
    displayName: 'Yali',
    timeZone: 'Asia/Tehran',
    updatedAt: now,
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.delete();
});

const outboxKeys = async () => (await db.outbox.toArray()).map((row) => row.key).sort();

async function addCard(word = 'brave'): Promise<string> {
  const result = await repo.addCard(draft(word));
  if (result.status !== 'created') throw new Error(`expected created, got ${result.status}`);
  return result.cardId;
}

describe('duplicate words', () => {
  it('findCardIdByWord ignores capitals and extra spaces, and deleted cards', async () => {
    const id = await addCard('ice cream');
    expect(await repo.findCardIdByWord('  ICE   cream ')).toBe(id);
    expect(await repo.findCardIdByWord('ice')).toBeUndefined();
    await db.cards.update(id, { deletedAt: now });
    expect(await repo.findCardIdByWord('ice cream')).toBeUndefined();
  });

  it('sendCardBackToStart moves a card to box 1, due tomorrow, even when mastered, and queues it', async () => {
    const id = await addCard();
    await db.cards.update(id, { box: 5, dueDate: '2026-04-01', masteredAt: now });
    await db.outbox.clear();
    now = '2026-03-12T08:00:00.000Z';
    await repo.sendCardBackToStart(id);
    expect(await db.cards.get(id)).toMatchObject({
      box: 1,
      dueDate: '2026-03-13',
      masteredAt: null,
      updatedAt: now,
    });
    expect(await outboxKeys()).toEqual([`cards:${id}`]);
  });

  it('sendCardBackToStart refuses an unknown card', async () => {
    await expect(repo.sendCardBackToStart('nope')).rejects.toThrow('No card');
  });
});

describe('addCard', () => {
  it('saves the card in box 1, due tomorrow, with its entries in order', async () => {
    const cardId = await addCard();
    const saved = await repo.getCard(cardId);
    expect(saved?.card).toMatchObject({
      word: 'brave',
      wordKey: 'brave',
      box: 1,
      dueDate: '2026-03-11',
      masteredAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(saved?.synonyms.map((e) => [e.text, e.position])).toEqual([
      ['bold', 0],
      ['daring', 1],
    ]);
    expect(saved?.meanings.map((e) => e.text)).toEqual(['شجاع']);
    expect(saved?.sentences.map((e) => e.text)).toEqual(['She was brave.']);
  });

  it('queues the card and every entry in the outbox', async () => {
    const cardId = await addCard();
    const entries = await db.entries.toArray();
    expect(await outboxKeys()).toEqual(
      [
        `cards:${cardId}`,
        ...entries.map((e) => `entries:${e.id}`),
        // Nothing was due and a word was added: today earned the streak (rule 3).
        'streakDays:2026-03-10',
      ].sort(),
    );
  });

  it('returns field errors and saves nothing when the form is incomplete', async () => {
    const result = await repo.addCard({ ...draft(), meanings: items(' '), sentences: [] });
    expect(result).toEqual({
      status: 'invalid',
      errors: { meanings: 'required', sentences: 'required' },
    });
    expect(await db.cards.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('"today" follows the profile time zone, not the phone', async () => {
    vi.stubEnv('TZ', 'Asia/Tehran');
    await repo.saveProfile({
      userId: 'u1',
      displayName: null,
      timeZone: 'America/New_York',
      updatedAt: now,
    });
    now = '2026-03-10T02:00:00.000Z'; // 10th in Tehran, still the 9th in New York
    const cardId = await addCard();
    expect((await repo.getCard(cardId))?.card.dueDate).toBe('2026-03-10');
  });

  it('uses UTC when no profile is saved', async () => {
    await db.profile.clear();
    now = '2026-03-09T22:00:00.000Z'; // 10th in Tehran, 9th in UTC
    const cardId = await addCard();
    expect((await repo.getCard(cardId))?.card.dueDate).toBe('2026-03-10');
  });
});

describe('addCard: duplicate word', () => {
  it.each(['brave', 'Brave', ' BRAVE  '])(
    '"%s" opens the existing card instead of a copy',
    async (again) => {
      const cardId = await addCard('brave');
      expect(await repo.addCard(draft(again))).toEqual({ status: 'duplicate', cardId });
      expect(await db.cards.count()).toBe(1);
    },
  );

  it('sends the existing card back to box 1, due tomorrow', async () => {
    const cardId = await addCard();
    await db.cards.update(cardId, { box: 4, dueDate: '2026-03-20' });
    now = '2026-03-12T08:00:00.000Z';
    await db.outbox.clear();

    await repo.addCard(draft());
    expect((await repo.getCard(cardId))?.card).toMatchObject({
      box: 1,
      dueDate: '2026-03-13',
      updatedAt: now,
    });
    expect(await outboxKeys()).toEqual([`cards:${cardId}`]);
  });

  it('un-masters a mastered card (option A)', async () => {
    const cardId = await addCard();
    await db.cards.update(cardId, { box: 5, masteredAt: '2026-03-01T00:00:00.000Z' });
    await repo.addCard(draft());
    expect((await repo.getCard(cardId))?.card).toMatchObject({ box: 1, masteredAt: null });
  });

  it('warns about a duplicate even if the rest of the form is still empty', async () => {
    const cardId = await addCard();
    const result = await repo.addCard({ word: 'Brave', synonyms: [], meanings: [], sentences: [] });
    expect(result).toEqual({ status: 'duplicate', cardId });
  });

  it('keeps the existing card’s entries (the new form is not merged in)', async () => {
    const cardId = await addCard();
    await repo.addCard({ ...draft(), synonyms: items('fearless') });
    expect((await repo.getCard(cardId))?.synonyms.map((e) => e.text)).toEqual(['bold', 'daring']);
  });
});

describe('editCard', () => {
  async function editForm(cardId: string) {
    const card = await repo.getCard(cardId);
    if (!card) throw new Error('missing');
    const toInput = (rows: { id: string; text: string }[]) =>
      rows.map(({ id, text }) => ({ id, text }));
    return {
      word: card.card.word,
      synonyms: toInput(card.synonyms),
      meanings: toInput(card.meanings),
      sentences: toInput(card.sentences),
    };
  }

  it('never changes the box or due date', async () => {
    const cardId = await addCard();
    await db.cards.update(cardId, { box: 3, dueDate: '2026-03-18' });
    const form = await editForm(cardId);
    await repo.editCard(cardId, { ...form, word: 'courageous' });
    expect((await repo.getCard(cardId))?.card).toMatchObject({
      word: 'courageous',
      wordKey: 'courageous',
      box: 3,
      dueDate: '2026-03-18',
    });
  });

  it('updates, adds, reorders and soft-deletes list items', async () => {
    const cardId = await addCard();
    const form = await editForm(cardId);
    const [bold, daring] = form.synonyms;
    now = '2026-03-11T08:00:00.000Z';
    await db.outbox.clear();

    const result = await repo.editCard(cardId, {
      ...form,
      synonyms: [{ ...daring, text: 'daring!' }, { text: 'fearless' }], // bold removed
    });
    expect(result).toEqual({ status: 'saved' });

    const saved = await repo.getCard(cardId);
    expect(saved?.synonyms.map((e) => [e.text, e.position])).toEqual([
      ['daring!', 0],
      ['fearless', 1],
    ]);
    expect(saved?.synonyms[0].id).toBe(daring.id);
    expect(await db.entries.get(bold.id)).toMatchObject({ deletedAt: now, updatedAt: now });

    const fearless = saved!.synonyms[1];
    expect(await outboxKeys()).toEqual(
      [`entries:${bold.id}`, `entries:${daring.id}`, `entries:${fearless.id}`].sort(),
    );
  });

  it('queues nothing when nothing changed', async () => {
    const cardId = await addCard();
    await db.outbox.clear();
    await repo.editCard(cardId, await editForm(cardId));
    expect(await db.outbox.count()).toBe(0);
  });

  it('blocks renaming to a word another card already has (Q1 option A)', async () => {
    await addCard('glad');
    const happy = await addCard('happy');
    const form = await editForm(happy);
    expect(await repo.editCard(happy, { ...form, word: ' Glad ' })).toEqual({
      status: 'invalid',
      errors: { word: 'duplicate' },
    });
    expect((await repo.getCard(happy))?.card.word).toBe('happy');
  });

  it('allows changing only the capitals of its own word', async () => {
    const cardId = await addCard('brave');
    await repo.editCard(cardId, { ...(await editForm(cardId)), word: 'Brave' });
    expect((await repo.getCard(cardId))?.card.word).toBe('Brave');
  });

  it('returns field errors and changes nothing for an incomplete form', async () => {
    const cardId = await addCard();
    const form = await editForm(cardId);
    expect(await repo.editCard(cardId, { ...form, sentences: items('') })).toEqual({
      status: 'invalid',
      errors: { sentences: 'required' },
    });
    expect((await repo.getCard(cardId))?.sentences).toHaveLength(1);
  });

  it('treats an unknown entry id as a new item', async () => {
    const cardId = await addCard();
    const form = await editForm(cardId);
    await repo.editCard(cardId, { ...form, meanings: [{ id: 'not-mine', text: 'دلیر' }] });
    const meanings = (await repo.getCard(cardId))?.meanings;
    expect(meanings?.map((e) => e.text)).toEqual(['دلیر']);
    expect(meanings?.[0].id).not.toBe('not-mine');
  });

  it('rejects an unknown card', async () => {
    await expect(repo.editCard('nope', draft())).rejects.toThrow(/No card/);
  });

  it('five edits while offline leave one outbox row for the card', async () => {
    const cardId = await addCard();
    await db.outbox.clear();
    for (const word of ['b1', 'b2', 'b3', 'b4', 'b5']) {
      await repo.editCard(cardId, { ...(await editForm(cardId)), word });
    }
    expect(await outboxKeys()).toEqual([`cards:${cardId}`]);
  });
});

describe('recordAnswer', () => {
  it('scheduled right answer: moves the card up and logs it', async () => {
    const cardId = await addCard();
    now = '2026-03-11T08:00:00.000Z';
    await db.outbox.clear();

    const log = await repo.recordAnswer(cardId, true, 'scheduled');
    expect(log).toMatchObject({
      cardId,
      reviewedAt: now,
      correct: true,
      boxBefore: 1,
      boxAfter: 2,
      isPractice: false,
    });
    expect((await repo.getCard(cardId))?.card).toMatchObject({
      box: 2,
      dueDate: '2026-03-13',
      updatedAt: now,
    });
    // The only due card was reviewed: today earned the streak (rule 2).
    expect(await outboxKeys()).toEqual(
      [`cards:${cardId}`, `reviewLogs:${log.id}`, 'streakDays:2026-03-11'].sort(),
    );
  });

  it('scheduled right answer in box 5: masters the card', async () => {
    const cardId = await addCard();
    await db.cards.update(cardId, { box: 5 });
    const log = await repo.recordAnswer(cardId, true, 'scheduled');
    expect(log.boxAfter).toBeNull();
    expect((await repo.getCard(cardId))?.card.masteredAt).toBe(now);
  });

  it('scheduled wrong answer: box 1, due tomorrow', async () => {
    const cardId = await addCard();
    await db.cards.update(cardId, { box: 4 });
    await repo.recordAnswer(cardId, false, 'scheduled');
    expect((await repo.getCard(cardId))?.card).toMatchObject({ box: 1, dueDate: '2026-03-11' });
  });

  it('practice answer: logs it but changes nothing on the card', async () => {
    const cardId = await addCard();
    const before = (await repo.getCard(cardId))?.card;
    await db.outbox.clear();

    const log = await repo.recordAnswer(cardId, false, 'practice');
    expect(log).toMatchObject({ isPractice: true, correct: false, boxBefore: 1, boxAfter: 1 });
    expect((await repo.getCard(cardId))?.card).toEqual(before);
    expect(await outboxKeys()).toEqual([`reviewLogs:${log.id}`]);
  });

  it('refuses a mastered card and saves nothing', async () => {
    const cardId = await addCard();
    await db.cards.update(cardId, { box: 5, masteredAt: now });
    await db.outbox.clear();
    await expect(repo.recordAnswer(cardId, true, 'scheduled')).rejects.toThrow(/mastered/);
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('rejects an unknown card', async () => {
    await expect(repo.recordAnswer('nope', true, 'practice')).rejects.toThrow(/No card/);
  });
});

describe('all or nothing', () => {
  it('a failure halfway through adding a card saves nothing at all', async () => {
    failOnId = 3; // card id = 1, first entry = 2, second entry = 3 → fails here
    await expect(repo.addCard(draft())).rejects.toThrow('boom');
    expect(await db.cards.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('a failure while logging an answer leaves the card where it was', async () => {
    const cardId = await addCard();
    failOnId = idCount + 1; // the log's id
    await expect(repo.recordAnswer(cardId, true, 'scheduled')).rejects.toThrow('boom');
    expect((await repo.getCard(cardId))?.card.box).toBe(1);
    expect(await db.reviewLogs.count()).toBe(0);
  });
});

describe('reads', () => {
  it('getCard hides missing and deleted cards', async () => {
    expect(await repo.getCard('nope')).toBeUndefined();
    const cardId = await addCard();
    await db.cards.update(cardId, { deletedAt: now });
    expect(await repo.getCard(cardId)).toBeUndefined();
  });

  it('a deleted card does not block adding the word again', async () => {
    const old = await addCard();
    await db.cards.update(old, { deletedAt: now });
    const result = await repo.addCard(draft());
    expect(result.status).toBe('created');
  });

  it('saveProfile replaces the saved profile', async () => {
    await repo.saveProfile({ userId: 'u1', displayName: 'Y', timeZone: 'UTC', updatedAt: now });
    expect(await repo.getProfile()).toMatchObject({ displayName: 'Y', timeZone: 'UTC' });
    expect(await db.profile.count()).toBe(1);
  });

  it('nextSessionCardIds gives due cards and stops at the daily cap', async () => {
    const ids = [await addCard('a'), await addCard('b'), await addCard('c')];
    expect(await repo.nextSessionCardIds()).toEqual([]); // new cards are due tomorrow

    now = '2026-03-11T08:00:00.000Z';
    expect((await repo.nextSessionCardIds()).sort()).toEqual([...ids].sort());

    await repo.recordAnswer(ids[0], true, 'scheduled');
    await repo.recordAnswer(ids[1], false, 'practice');
    expect(await repo.reviewsDoneToday()).toBe(1); // practice doesn't count
    expect((await repo.nextSessionCardIds()).sort()).toEqual([ids[1], ids[2]].sort());

    await db.reviewLogs.bulkAdd(
      Array.from({ length: 99 }, (_, i) => ({
        id: `log-${i}`,
        cardId: ids[2],
        reviewedAt: now,
        correct: true,
        boxBefore: 1 as const,
        boxAfter: 2 as const,
        isPractice: false,
        createdAt: now,
      })),
    );
    expect(await repo.reviewsDoneToday()).toBe(100);
    expect(await repo.nextSessionCardIds()).toEqual([]); // cap reached → All done
  });

  it('nextSessionCardIds updates live after an answer (useLiveQuery)', async () => {
    const id = await addCard();
    now = '2026-03-11T08:00:00.000Z';
    const seen: number[] = [];
    const sub = liveQuery(() => repo.nextSessionCardIds()).subscribe((ids) =>
      seen.push(ids.length),
    );
    await vi.waitFor(() => expect(seen).toEqual([1]));
    await repo.recordAnswer(id, true, 'scheduled');
    await vi.waitFor(() => expect(seen).toEqual([1, 0]));
    sub.unsubscribe();
  });

  it('nextSessionCardIds uses the profile day, not the latest day on Earth', async () => {
    await addCard(); // due 2026-03-11 (Tehran)
    now = '2026-03-10T19:00:00.000Z'; // 22:30 on the 10th in Tehran, 09:00 on the 11th at UTC+14
    expect(await repo.nextSessionCardIds()).toEqual([]);
  });

  it('reviewsDoneToday ignores yesterday (profile day)', async () => {
    const cardId = await addCard();
    now = '2026-03-10T20:00:00.000Z'; // 23:30 on the 10th in Tehran
    await repo.recordAnswer(cardId, false, 'scheduled');
    now = '2026-03-10T20:31:00.000Z'; // 00:01 on the 11th in Tehran
    expect(await repo.reviewsDoneToday()).toBe(0);
  });
});

describe('one database per account (Q2 option A)', () => {
  it('names the database after the account', () => {
    expect(databaseNameFor('abc')).toBe('leitner-abc');
  });

  it('two accounts on one phone never see each other’s cards', async () => {
    const first = openDatabase(`user-${crypto.randomUUID()}`);
    const second = openDatabase(`user-${crypto.randomUUID()}`);
    try {
      await createRepository(first).addCard(draft());
      expect(await first.cards.count()).toBe(1);
      expect(await second.cards.count()).toBe(0);
    } finally {
      await first.delete();
      await second.delete();
    }
  });
});

describe('streak and words learned (roadmap 7.11, ADR-015)', () => {
  const DAY_2 = '2026-03-11T08:00:00.000Z';
  const streakDays = async () => (await db.streakDays.toArray()).map((d) => d.day);

  /** Adds the words on day 1 (so they are due on day 2) and forgets day 1's streak day. */
  async function cardsDueTomorrow(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push(await addCard(`word${i}`));
    await db.streakDays.clear();
    now = DAY_2;
    return ids;
  }

  it('rule 1: 20 scheduled reviews earn the day, even with more still due', async () => {
    const ids = await cardsDueTomorrow(25);
    for (const id of ids.slice(0, 19)) await repo.recordAnswer(id, true, 'scheduled');
    expect(await streakDays()).toEqual([]);
    await repo.recordAnswer(ids[19], false, 'scheduled');
    expect(await streakDays()).toEqual(['2026-03-11']);
  });

  it('rule 2: fewer than 20 due, and all of them reviewed', async () => {
    const ids = await cardsDueTomorrow(3);
    await repo.recordAnswer(ids[0], true, 'scheduled');
    await repo.recordAnswer(ids[1], false, 'scheduled');
    expect(await streakDays()).toEqual([]);
    await repo.recordAnswer(ids[2], true, 'scheduled');
    expect(await streakDays()).toEqual(['2026-03-11']);
  });

  it('practice answers never earn the day', async () => {
    const [id] = await cardsDueTomorrow(2);
    await repo.recordAnswer(id, false, 'scheduled');
    await repo.recordAnswer(id, true, 'practice');
    expect(await streakDays()).toEqual([]);
  });

  it('rule 3: a new word earns the day only when nothing was due', async () => {
    await cardsDueTomorrow(1);
    await addCard('calm');
    expect(await streakDays()).toEqual([]);

    now = '2026-03-12T08:00:00.000Z'; // the 11th's cards were never reviewed; still due
    await db.cards.toCollection().modify({ dueDate: '2026-03-20' });
    await addCard('quiet');
    expect(await streakDays()).toEqual(['2026-03-12']);
  });

  it('sending a duplicate word back to box 1 is not a new word', async () => {
    await cardsDueTomorrow(0);
    await addCard('brave');
    await db.streakDays.clear();
    await db.outbox.clear();
    expect((await repo.addCard(draft('brave'))).status).toBe('duplicate');
    expect(await streakDays()).toEqual([]);
  });

  it('saves the day once, in the profile time zone, and queues it for sync', async () => {
    now = '2026-03-10T21:00:00.000Z'; // 00:30 on the 11th in Tehran, still the 10th in UTC
    await addCard('brave');
    await addCard('calm');
    expect(await db.streakDays.toArray()).toEqual([
      { day: '2026-03-11', id: expect.any(String), createdAt: now },
    ]);
    expect((await outboxKeys()).filter((k) => k.startsWith('streakDays'))).toEqual([
      'streakDays:2026-03-11',
    ]);
  });

  it('progress: the streak counts earned days in a row and shows yesterday until today counts', async () => {
    await db.streakDays.bulkAdd(
      ['2026-03-06', '2026-03-08', '2026-03-09'].map((day) => ({ day, id: day, createdAt: now })),
    );
    expect((await repo.progress()).streak).toBe(2); // the 10th is not earned yet
    await addCard('brave'); // nothing due: rule 3 earns the 10th
    expect((await repo.progress()).streak).toBe(3);
    now = '2026-03-12T08:00:00.000Z'; // the 11th was missed
    expect((await repo.progress()).streak).toBe(0);
  });

  it('progress: words learned counts cards that passed box 1 and never goes down', async () => {
    const [a, b] = await cardsDueTomorrow(2);
    expect((await repo.progress()).wordsLearned).toBe(0);
    await repo.recordAnswer(a, true, 'scheduled');
    await repo.recordAnswer(b, false, 'scheduled');
    await repo.recordAnswer(b, true, 'practice');
    expect((await repo.progress()).wordsLearned).toBe(1);

    now = '2026-03-13T08:00:00.000Z';
    await repo.recordAnswer(a, false, 'scheduled'); // back to box 1
    await repo.sendCardBackToStart(a);
    expect((await repo.progress()).wordsLearned).toBe(1);
  });

  it('progress refreshes a live query after an answer', async () => {
    const [id] = await cardsDueTomorrow(1);
    const seen: number[] = [];
    const sub = liveQuery(() => repo.progress()).subscribe((p) => seen.push(p.wordsLearned));
    await vi.waitFor(() => expect(seen).toEqual([0]));
    await repo.recordAnswer(id, true, 'scheduled');
    await vi.waitFor(() => expect(seen[seen.length - 1]).toBe(1));
    sub.unsubscribe();
  });
});

describe('waiting today and the reminder offer (ADR-018)', () => {
  it('waitingToday counts the due words, and goes down as you review', async () => {
    const ids = [await addCard('brave'), await addCard('calm')];
    expect(await repo.waitingToday()).toBe(0); // due tomorrow
    now = '2026-03-11T08:00:00.000Z';
    expect(await repo.waitingToday()).toBe(2);
    await repo.recordAnswer(ids[0], true, 'scheduled');
    expect(await repo.waitingToday()).toBe(1);
  });

  it('the offer is open until answered: "done" closes it for good, "snooze" for 7 days', async () => {
    expect(await repo.reminderOfferOpen()).toBe(true);
    await repo.closeReminderOffer('snooze');
    expect(await repo.reminderOfferOpen()).toBe(false);
    now = '2026-03-17T08:00:00.000Z';
    expect(await repo.reminderOfferOpen()).toBe(true);
    await repo.closeReminderOffer('done');
    now = '2027-03-17T08:00:00.000Z';
    expect(await repo.reminderOfferOpen()).toBe(false);
  });
});
