import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBackup } from '../domain/backup/file';
import type { CardDraft } from '../domain/card/validate';
import { LeitnerDb } from './db';
import { createRepository, type Repository } from './repository';
import { cardFromRemote, cardToRemote, logFromRemote, logToRemote } from './sync/mapping';

const draft = (word: string): CardDraft => ({
  word,
  synonyms: [{ text: 'bold' }],
  meanings: [{ text: 'شجاع' }],
  sentences: [{ text: `A ${word} sentence.` }],
});

const dbs: Dexie[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe('Dexie version 4 upgrade (v3 decks)', () => {
  it('turns every old card into a vocab card added on its creation day (profile time zone)', async () => {
    const name = `upgrade-${crypto.randomUUID()}`;
    // The database as the app before v3 left it.
    const old = new Dexie(name);
    old.version(1).stores({
      cards: 'id, wordKey, dueDate, updatedAt',
      entries: 'id, cardId, updatedAt',
      reviewLogs: 'id, cardId, reviewedAt',
      outbox: 'key, queuedAt',
      profile: 'userId',
    });
    old.version(2).stores({ meta: 'key' });
    old.version(3).stores({ reviewLogs: 'id, cardId, reviewedAt, boxBefore', streakDays: 'day' });
    const base = { box: 1, dueDate: '2026-03-12', masteredAt: null, deletedAt: null };
    await old.table('profile').put({
      userId: 'u1',
      displayName: 'Yali',
      timeZone: 'Asia/Tehran',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    await old.table('cards').bulkPut([
      // 23:30 UTC is already the 11th in Tehran.
      {
        ...base,
        id: 'a',
        word: 'brave',
        wordKey: 'brave',
        createdAt: '2026-03-10T23:30:00.000Z',
        updatedAt: 'x',
      },
      // Pulled from the cloud: Postgres' own format.
      {
        ...base,
        id: 'b',
        word: 'calm',
        wordKey: 'calm',
        createdAt: '2026-03-10 08:00:00.123456+00:00',
        updatedAt: 'x',
      },
    ]);
    old.close();
    dbs.push(old);

    const db = new LeitnerDb(name);
    dbs.push(db);
    const cards = await db.cards.orderBy('id').toArray();
    expect(cards.map((c) => [c.id, c.deck, c.addedOn])).toEqual([
      ['a', 'vocab', '2026-03-11'],
      ['b', 'vocab', '2026-03-10'],
    ]);
    // The "one card per word per deck" lookup works on the upgraded rows.
    expect(await db.cards.where('[deck+wordKey]').equals(['vocab', 'calm']).count()).toBe(1);
  });

  it('uses UTC when the device has no saved profile yet', async () => {
    const name = `upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      cards: 'id, wordKey, dueDate, updatedAt',
      entries: 'id, cardId, updatedAt',
      reviewLogs: 'id, cardId, reviewedAt',
      outbox: 'key, queuedAt',
      profile: 'userId',
    });
    old.version(2).stores({ meta: 'key' });
    old.version(3).stores({ reviewLogs: 'id, cardId, reviewedAt, boxBefore', streakDays: 'day' });
    await old.table('cards').put({
      id: 'a',
      word: 'brave',
      wordKey: 'brave',
      box: 1,
      dueDate: '2026-03-12',
      masteredAt: null,
      createdAt: '2026-03-10T23:30:00.000Z',
      updatedAt: 'x',
      deletedAt: null,
    });
    old.close();
    dbs.push(old);

    const db = new LeitnerDb(name);
    dbs.push(db);
    expect((await db.cards.get('a'))?.addedOn).toBe('2026-03-10');
  });
});

describe('one card per word per deck', () => {
  let db: LeitnerDb;
  let repo: Repository;
  let now: string;
  beforeEach(async () => {
    db = new LeitnerDb(`decks-${crypto.randomUUID()}`);
    dbs.push(db);
    now = '2026-03-10T08:00:00.000Z';
    repo = createRepository(db, { now: () => now, newId: () => crypto.randomUUID() });
    await repo.saveProfile({
      userId: 'u1',
      displayName: 'Yali',
      timeZone: 'Asia/Tehran',
      updatedAt: now,
    });
  });

  it('the same word can live in two decks, each with its own box', async () => {
    const vocab = await repo.addCard(draft('brave'));
    const spelling = await repo.addCard(draft('brave'), 'spelling');
    expect(vocab.status).toBe('created');
    expect(spelling.status).toBe('created');
    if (vocab.status !== 'created' || spelling.status !== 'created') return;
    expect(vocab.cardId).not.toBe(spelling.cardId);
    expect((await db.cards.get(spelling.cardId))?.deck).toBe('spelling');
    expect(await repo.findCardIdByWord('Brave')).toBe(vocab.cardId);
    expect(await repo.findCardIdByWord('Brave', 'spelling')).toBe(spelling.cardId);
    expect(await repo.findCardIdByWord('Brave', 'phrases')).toBeUndefined();
  });

  it('a duplicate inside one deck goes back to box 1 and counts as added today', async () => {
    const first = await repo.addCard(draft('brave'), 'spelling');
    if (first.status !== 'created') throw new Error(first.status);
    await db.cards.update(first.cardId, { box: 4, addedOn: '2026-03-01' });
    now = '2026-03-12T08:00:00.000Z';
    expect(await repo.addCard(draft('BRAVE'), 'spelling')).toEqual({
      status: 'duplicate',
      cardId: first.cardId,
    });
    expect(await db.cards.get(first.cardId)).toMatchObject({ box: 1, addedOn: '2026-03-12' });
    await db.cards.update(first.cardId, { box: 3, addedOn: '2026-03-01' });
    await repo.sendCardBackToStart(first.cardId);
    expect(await db.cards.get(first.cardId)).toMatchObject({ box: 1, addedOn: '2026-03-12' });
  });

  it('a new card is added today, in the profile time zone', async () => {
    now = '2026-03-10T23:30:00.000Z'; // already the 11th in Tehran
    const result = await repo.addCard(draft('brave'));
    if (result.status !== 'created') throw new Error(result.status);
    expect((await db.cards.get(result.cardId))?.addedOn).toBe('2026-03-11');
  });

  it('renaming a card to a word another deck has is allowed; inside its own deck it is refused', async () => {
    await repo.addCard(draft('brave'), 'spelling');
    const calm = await repo.addCard(draft('calm'));
    if (calm.status !== 'created') throw new Error(calm.status);
    expect((await repo.editCard(calm.cardId, draft('brave'))).status).not.toBe('invalid');
    const other = await repo.addCard(draft('quiet'));
    if (other.status !== 'created') throw new Error(other.status);
    expect(await repo.editCard(other.cardId, draft('brave'))).toEqual({
      status: 'invalid',
      errors: { word: 'duplicate' },
    });
  });
});

describe('backup version 2 and old version-1 files', () => {
  let db: LeitnerDb;
  let repo: Repository;
  const now = '2026-03-10T08:00:00.000Z';
  async function freshBox() {
    const d = new LeitnerDb(`backup2-${crypto.randomUUID()}`);
    dbs.push(d);
    const r = createRepository(d, { now: () => now, newId: () => crypto.randomUUID() });
    await r.saveProfile({
      userId: 'u1',
      displayName: 'Yali',
      timeZone: 'Asia/Tehran',
      updatedAt: now,
    });
    return { d, r };
  }
  beforeEach(async () => {
    ({ d: db, r: repo } = await freshBox());
  });

  it('round trip: decks, addedOn and typed answers come back exactly', async () => {
    await repo.addCard(draft('brave'));
    const spelling = await repo.addCard(draft('brave'), 'spelling');
    if (spelling.status !== 'created') throw new Error(spelling.status);
    await db.reviewLogs.add({
      id: 'l1',
      cardId: spelling.cardId,
      reviewedAt: now,
      correct: false,
      boxBefore: 1,
      boxAfter: 1,
      isPractice: false,
      typedAnswer: 'bravve',
      createdAt: now,
    });
    const file = JSON.stringify(await repo.exportBackup('u1'));
    expect(JSON.parse(file).version).toBe(2);
    const read = readBackup(file);
    if (!read.ok) throw new Error(read.problem);

    const { d: other, r: restored } = await freshBox();
    expect(await restored.importBackup(read.backup, 'u1')).toMatchObject({ wordsAdded: 2 });
    const rows = async (d: LeitnerDb) => ({
      cards: await d.cards.orderBy('id').toArray(),
      logs: await d.reviewLogs.orderBy('id').toArray(),
    });
    expect(await rows(other)).toEqual(await rows(db));
    expect((await rows(other)).cards.map((c) => c.deck).sort()).toEqual(['spelling', 'vocab']);
    expect((await rows(other)).logs[0].typedAnswer).toBe('bravve');
  });

  it('a version-1 file restores: every card becomes vocab, added on its creation day', async () => {
    const v1 = {
      app: 'leitner-backup',
      version: 1,
      exportedAt: now,
      userId: 'u1',
      profile: { displayName: 'Yali', timeZone: 'Asia/Tehran' },
      cards: [
        {
          id: 'c1',
          word: 'brave',
          box: 2,
          dueDate: '2026-03-12',
          masteredAt: null,
          createdAt: '2026-03-09T22:00:00.000Z',
          updatedAt: now,
          deletedAt: null,
        },
      ],
      entries: [],
      reviewLogs: [
        {
          id: 'l1',
          cardId: 'c1',
          reviewedAt: now,
          correct: true,
          boxBefore: 1,
          boxAfter: 2,
          isPractice: false,
          createdAt: now,
        },
      ],
      streakDays: [],
    };
    const read = readBackup(JSON.stringify(v1));
    if (!read.ok) throw new Error(read.problem);
    expect(await repo.importBackup(read.backup, 'u1')).toMatchObject({ wordsAdded: 1 });
    expect(await db.cards.get('c1')).toMatchObject({
      deck: 'vocab',
      addedOn: '2026-03-10', // 22:00 UTC on the 9th is 01:30 on the 10th in Tehran
      wordKey: 'brave',
    });
    expect((await db.reviewLogs.get('l1'))?.typedAnswer).toBeNull();
  });

  it('the same word in another deck is not merged on import', async () => {
    await repo.addCard(draft('brave'));
    const { d: other, r: otherRepo } = await freshBox();
    await otherRepo.addCard(draft('brave'), 'spelling');
    const read = readBackup(JSON.stringify(await otherRepo.exportBackup('u1')));
    if (!read.ok) throw new Error(read.problem);
    expect(await repo.importBackup(read.backup, 'u1')).toMatchObject({ wordsAdded: 1 });
    expect(await db.cards.count()).toBe(2);
    expect(await other.cards.count()).toBe(1);
  });
});

describe('sync mapping for decks', () => {
  const remote = {
    id: 'c1',
    user_id: 'u',
    word: 'Ice Cream',
    deck: 'spelling',
    added_on: '2026-03-02',
    box: 2,
    due_date: '2026-03-14',
    mastered_at: null,
    created_at: '2026-03-01T08:00:00.000Z',
    updated_at: '2026-03-10T08:00:00.000Z',
    deleted_at: null,
    server_updated_at: 'x',
  };

  it('carries deck and addedOn both ways', () => {
    const card = cardFromRemote(remote);
    expect(card).toMatchObject({ deck: 'spelling', addedOn: '2026-03-02', wordKey: 'ice cream' });
    expect(cardToRemote(card)).toMatchObject({ deck: 'spelling', added_on: '2026-03-02' });
  });

  it('reads an old cloud row without a deck or addedOn as vocab, added on its creation day', () => {
    const old = { ...remote, deck: undefined, added_on: undefined } as unknown as typeof remote;
    expect(cardFromRemote(old)).toMatchObject({ deck: 'vocab', addedOn: '2026-03-01' });
  });

  it('carries the typed answer of a review', () => {
    const log = {
      id: 'l1',
      cardId: 'c1',
      reviewedAt: 't',
      correct: false,
      boxBefore: 1 as const,
      boxAfter: 1 as const,
      isPractice: false,
      typedAnswer: 'bravve',
      createdAt: 't',
    };
    const upload = logToRemote(log);
    expect(upload.typed_answer).toBe('bravve');
    expect(logFromRemote({ ...upload, user_id: 'u', server_updated_at: 'x' })).toEqual(log);
    expect(logToRemote({ ...log, typedAnswer: undefined }).typed_answer).toBeNull();
  });
});
