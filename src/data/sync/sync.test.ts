import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardDraft } from '../../domain/card/validate';
import { createFakeCloud, type FakeCloud } from '../../test/fakeCloud';
import { LeitnerDb } from '../db';
import { createRepository, type Repository } from '../repository';
import { PULL_PAGE, createSync, type Sync } from './sync';

const items = (...texts: string[]) => texts.map((text) => ({ text }));
const draft = (word: string, synonyms = ['bold']): CardDraft => ({
  word,
  synonyms: items(...synonyms),
  meanings: items('شجاع'),
  sentences: items(`A ${word} sentence.`),
});

/** One phone, laptop… with its own database, clock and sync, sharing the cloud. */
interface Device {
  db: LeitnerDb;
  repo: Repository;
  sync: Sync;
  clock: { now: string };
}

let cloud: FakeCloud;
let devices: Device[];

function device(): Device {
  const db = new LeitnerDb(`sync-test-${crypto.randomUUID()}`);
  const clock = { now: '2026-03-10T08:00:00.000Z' };
  const deps = { now: () => clock.now, newId: () => crypto.randomUUID() };
  const created: Device = {
    db,
    clock,
    repo: createRepository(db, deps),
    sync: createSync(db, cloud, deps),
  };
  devices.push(created);
  return created;
}

beforeEach(async () => {
  cloud = createFakeCloud();
  devices = [];
});

afterEach(async () => {
  for (const d of devices) await d.db.delete();
});

async function add(d: Device, word: string, synonyms?: string[]): Promise<string> {
  const result = await d.repo.addCard(draft(word, synonyms));
  if (result.status !== 'created') throw new Error(result.status);
  return result.cardId;
}

async function editWord(d: Device, cardId: string, word: string) {
  const card = await d.repo.getCard(cardId);
  if (!card) throw new Error('missing');
  const keep = (rows: { id: string; text: string }[]) => rows.map(({ id, text }) => ({ id, text }));
  return d.repo.editCard(cardId, {
    word,
    synonyms: keep(card.synonyms),
    meanings: keep(card.meanings),
    sentences: keep(card.sentences),
  });
}

/** Everything a person could see about the box, without device-only fields. */
async function snapshot(d: Device) {
  const cards = await d.db.cards.orderBy('id').toArray();
  const entries = await d.db.entries.orderBy('id').toArray();
  const logs = await d.db.reviewLogs.orderBy('id').toArray();
  return { cards, entries, logs };
}

describe('push', () => {
  it('sends a new card with its entries, then clears the outbox', async () => {
    const phone = device();
    const cardId = await add(phone, 'brave');
    const summary = await phone.sync.run();

    expect(cloud.tables.cards.get(cardId)).toMatchObject({
      word: 'brave',
      box: 1,
      user_id: 'user-1',
    });
    expect(
      [...cloud.tables.card_entries.values()].filter((e) => e.card_id === cardId),
    ).toHaveLength(3);
    expect(await phone.db.outbox.count()).toBe(0);
    expect(summary.pushed).toBe(4);
  });

  it('sends cards before entries before logs (the database needs the card first)', async () => {
    const phone = device();
    const cardId = await add(phone, 'brave');
    await phone.repo.recordAnswer(cardId, true, 'scheduled');
    await phone.sync.run();
    const uploads = cloud.calls.filter((c) => !c.startsWith('pull'));
    expect(uploads).toEqual(['upsertCards', 'upsertEntries', 'insertLogs']);
  });

  it('offline: nothing is lost; the next run sends it', async () => {
    const phone = device();
    await add(phone, 'brave');
    cloud.offline = true;
    await expect(phone.sync.run()).rejects.toThrow('Failed to fetch');
    expect(await phone.db.outbox.count()).toBe(4);

    cloud.offline = false;
    await phone.sync.run();
    expect(await phone.db.outbox.count()).toBe(0);
    expect(cloud.tables.cards.size).toBe(1);
  });

  it('a card edited while it is being sent stays in the outbox for the next run', async () => {
    const phone = device();
    const cardId = await add(phone, 'brave');
    cloud.duringNextUpload = async () => {
      phone.clock.now = '2026-03-10T08:00:05.000Z';
      await editWord(phone, cardId, 'courageous');
    };
    await phone.sync.run();
    expect(await phone.db.outbox.get(`cards:${cardId}`)).toBeDefined();

    await phone.sync.run();
    expect(cloud.tables.cards.get(cardId)?.word).toBe('courageous');
    expect(await phone.db.outbox.count()).toBe(0);
  });

  it('sends large backlogs in batches (30 days offline)', async () => {
    const phone = device();
    for (let i = 0; i < 70; i++) await add(phone, `word${i}`);
    await phone.sync.run(); // 70 cards + 210 entries
    expect(cloud.tables.card_entries.size).toBe(210);
    expect(cloud.calls.filter((c) => c === 'upsertEntries')).toHaveLength(2); // 200 + 10
  });
});

describe('pull', () => {
  it('a second device gets everything, identical', async () => {
    const phone = device();
    const laptop = device();
    const cardId = await add(phone, 'brave');
    await phone.repo.recordAnswer(cardId, true, 'scheduled');
    await phone.sync.run();

    await laptop.sync.run();
    expect(await snapshot(laptop)).toEqual(await snapshot(phone));
    expect(await laptop.db.outbox.count()).toBe(0); // pulled rows are not sent back
  });

  it('pulls in pages and remembers where it stopped', async () => {
    const phone = device();
    const cardId = await add(phone, 'brave');
    await phone.sync.run();
    // Many review logs straight in the cloud (e.g. from months of use on another device).
    const logs = Array.from({ length: PULL_PAGE * 2 + 5 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      card_id: cardId,
      reviewed_at: '2026-03-10T08:00:00.000Z',
      correct: true,
      box_before: 1,
      box_after: 2,
      is_practice: false,
      created_at: '2026-03-10T08:00:00.000Z',
    }));
    await cloud.insertLogs(logs);

    const laptop = device();
    cloud.calls.length = 0;
    await laptop.sync.run();
    expect(await laptop.db.reviewLogs.count()).toBe(PULL_PAGE * 2 + 5);
    expect(cloud.calls.filter((c) => c === 'pull:review_logs')).toHaveLength(3);
    expect(await laptop.db.meta.get('pull:review_logs')).toBeDefined();
  });

  it('a later sync only downloads what changed (plus a short safety overlap)', async () => {
    const phone = device();
    const laptop = device();
    for (const w of ['a', 'b', 'c']) await add(phone, w);
    await phone.sync.run();
    await laptop.sync.run();

    const before = { ...(await laptop.db.meta.get('pull:cards')) };
    await laptop.sync.run();
    expect(await laptop.db.cards.count()).toBe(3); // nothing duplicated
    expect(await laptop.db.meta.get('pull:cards')).toEqual(before); // the cursor never moves back
  });

  it('review logs are never duplicated, however often you sync', async () => {
    const phone = device();
    const laptop = device();
    const cardId = await add(phone, 'brave');
    await phone.repo.recordAnswer(cardId, true, 'scheduled');
    await phone.sync.run();
    await laptop.sync.run();
    await laptop.sync.run();
    await phone.sync.run();
    expect(await laptop.db.reviewLogs.count()).toBe(1);
    expect(await phone.db.reviewLogs.count()).toBe(1);
    expect(cloud.tables.review_logs.size).toBe(1);
  });
});

describe('last write wins (two devices, offline edits)', () => {
  async function shared() {
    const phone = device();
    const laptop = device();
    const cardId = await add(phone, 'brave');
    await phone.sync.run();
    await laptop.sync.run();
    return { phone, laptop, cardId };
  }

  it('newer edit wins when it syncs last', async () => {
    const { phone, laptop, cardId } = await shared();
    phone.clock.now = '2026-03-11T08:00:00.000Z';
    await editWord(phone, cardId, 'brave-phone');
    laptop.clock.now = '2026-03-12T08:00:00.000Z';
    await editWord(laptop, cardId, 'brave-laptop');

    await phone.sync.run();
    await laptop.sync.run();
    await phone.sync.run();
    for (const d of [phone, laptop])
      expect((await d.repo.getCard(cardId))?.card.word).toBe('brave-laptop');
  });

  it('newer edit wins even when the older one reaches the cloud later', async () => {
    const { phone, laptop, cardId } = await shared();
    phone.clock.now = '2026-03-11T08:00:00.000Z';
    await editWord(phone, cardId, 'brave-older');
    laptop.clock.now = '2026-03-12T08:00:00.000Z';
    await editWord(laptop, cardId, 'brave-newer');

    await laptop.sync.run(); // newer first
    await phone.sync.run(); // older arrives late: refused by the cloud, then replaced locally
    expect(cloud.tables.cards.get(cardId)?.word).toBe('brave-newer');
    expect((await phone.repo.getCard(cardId))?.card.word).toBe('brave-newer');
    expect(await phone.db.outbox.count()).toBe(0);
  });

  it('an edit made offline on Monday and sent on Friday still reaches a device that synced Wednesday', async () => {
    const { phone, laptop, cardId } = await shared();
    phone.clock.now = '2026-03-16T08:00:00.000Z'; // Monday, offline
    await editWord(phone, cardId, 'brave-monday');
    laptop.clock.now = '2026-03-18T08:00:00.000Z'; // Wednesday: laptop syncs, sees nothing new
    await laptop.sync.run();
    await phone.sync.run(); // Friday: phone back online
    await laptop.sync.run();
    expect((await laptop.repo.getCard(cardId))?.card.word).toBe('brave-monday');
  });

  it('a removed list item disappears on the other device too', async () => {
    const { phone, laptop, cardId } = await shared();
    const card = await phone.repo.getCard(cardId);
    phone.clock.now = '2026-03-11T08:00:00.000Z';
    await phone.repo.editCard(cardId, {
      word: 'brave',
      synonyms: items('daring'), // "bold" removed, "daring" added
      meanings: card!.meanings.map(({ id, text }) => ({ id, text })),
      sentences: card!.sentences.map(({ id, text }) => ({ id, text })),
    });
    await phone.sync.run();
    await laptop.sync.run();
    expect((await laptop.repo.getCard(cardId))?.synonyms.map((e) => e.text)).toEqual(['daring']);
  });

  it('answers on both devices: the card ends up identical everywhere', async () => {
    const { phone, laptop, cardId } = await shared();
    phone.clock.now = '2026-03-11T08:00:00.000Z';
    await phone.repo.recordAnswer(cardId, true, 'scheduled'); // box 2
    laptop.clock.now = '2026-03-11T09:00:00.000Z';
    await laptop.repo.recordAnswer(cardId, false, 'scheduled'); // box 1, later
    await phone.sync.run();
    await laptop.sync.run();
    await phone.sync.run();
    expect((await snapshot(phone)).cards).toEqual((await snapshot(laptop)).cards);
    expect((await phone.repo.getCard(cardId))?.card.box).toBe(1); // the later answer wins
    expect(await phone.db.reviewLogs.count()).toBe(2); // both answers are kept in the history
  });
});

describe('the same word added on two devices while offline (Q2 option A)', () => {
  it('merges into one card: lists combined without repeats, cloud box kept, history moved', async () => {
    const phone = device();
    const laptop = device();
    const phoneCard = await add(phone, 'brave', ['bold', 'daring']);
    phone.clock.now = '2026-03-11T08:00:00.000Z';
    await phone.repo.recordAnswer(phoneCard, true, 'scheduled'); // phone's copy → box 2
    await phone.sync.run();

    const laptopCard = await add(laptop, 'Brave', ['Bold', 'fearless']); // laptop never synced
    await laptop.repo.recordAnswer(laptopCard, false, 'practice');
    const summary = await laptop.sync.run();
    expect(summary.merged).toBe(1);

    // One card in the cloud, the phone's, with its box.
    expect([...cloud.tables.cards.values()].map((c) => [c.id, c.box])).toEqual([[phoneCard, 2]]);
    // The laptop now uses the cloud card; its own copy is gone.
    expect(await laptop.repo.getCard(laptopCard)).toBeUndefined();
    const merged = await laptop.repo.getCard(phoneCard);
    expect(merged?.synonyms.map((e) => e.text)).toEqual(['bold', 'daring', 'fearless']);
    expect(merged?.meanings.map((e) => e.text)).toEqual(['شجاع']); // same text: not repeated
    // Differs only in capitals: a repeat, so kept once.
    expect(merged?.sentences.map((e) => e.text)).toEqual(['A brave sentence.']);
    expect(merged?.card.box).toBe(2);
    // Both histories are in the cloud, all on the one card.
    const logs = [...cloud.tables.review_logs.values()];
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.card_id === phoneCard)).toBe(true);

    // And the phone sees the combined lists after its next sync.
    await phone.sync.run();
    expect((await phone.repo.getCard(phoneCard))?.synonyms.map((e) => e.text)).toEqual([
      'bold',
      'daring',
      'fearless',
    ]);
    expect(await laptop.db.outbox.count()).toBe(0);
  });

  it('other new cards in the same upload still go through', async () => {
    const phone = device();
    const laptop = device();
    await add(phone, 'brave');
    await phone.sync.run();
    await add(laptop, 'calm');
    await add(laptop, 'brave');
    await add(laptop, 'eager');
    await laptop.sync.run();
    expect([...cloud.tables.cards.values()].map((c) => c.word).sort()).toEqual([
      'brave',
      'calm',
      'eager',
    ]);
    expect(await laptop.db.cards.count()).toBe(3);
    expect(await laptop.db.outbox.count()).toBe(0);
  });
});
