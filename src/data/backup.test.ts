import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBackup, type Backup } from '../domain/backup/file';
import type { CardDraft } from '../domain/card/validate';
import { createFakeCloud } from '../test/fakeCloud';
import { LeitnerDb, META } from './db';
import { createRepository, type Repository } from './repository';
import { createSync } from './sync/sync';

const items = (...texts: string[]) => texts.map((text) => ({ text }));
const draft = (word: string, synonyms = ['bold']): CardDraft => ({
  word,
  synonyms: items(...synonyms),
  meanings: items('شجاع'),
  sentences: items(`A ${word} sentence.`),
});

interface Box {
  db: LeitnerDb;
  repo: Repository;
  clock: { now: string };
}

const boxes: LeitnerDb[] = [];

async function box(withProfile = true): Promise<Box> {
  const db = new LeitnerDb(`backup-test-${crypto.randomUUID()}`);
  boxes.push(db);
  const clock = { now: '2026-03-10T08:00:00.000Z' };
  const repo = createRepository(db, { now: () => clock.now, newId: () => crypto.randomUUID() });
  if (withProfile) {
    await repo.saveProfile({
      userId: 'u1',
      displayName: 'Yali',
      timeZone: 'Asia/Tehran',
      updatedAt: clock.now,
    });
  }
  return { db, repo, clock };
}

afterEach(async () => {
  for (const db of boxes.splice(0)) await db.delete();
});

async function add(b: Box, word: string, synonyms?: string[]): Promise<string> {
  const result = await b.repo.addCard(draft(word, synonyms));
  if (result.status !== 'created') throw new Error(result.status);
  return result.cardId;
}

/** Writes the backup to a file's text and reads it back, like the real save and restore. */
async function throughFile(b: Box): Promise<Backup> {
  const result = readBackup(JSON.stringify(await b.repo.exportBackup('u1')));
  if (!result.ok) throw new Error(result.problem);
  return result.backup;
}

async function tables(db: LeitnerDb) {
  return {
    cards: await db.cards.orderBy('id').toArray(),
    entries: await db.entries.orderBy('id').toArray(),
    logs: await db.reviewLogs.orderBy('id').toArray(),
    streakDays: await db.streakDays.toArray(),
  };
}

/** A box with some history: answers, a mastered word, an edit with a removed item, streak days. */
async function filledBox(): Promise<Box> {
  const phone = await box();
  const brave = await add(phone, 'brave', ['bold', 'daring']);
  const calm = await add(phone, 'calm');
  await add(phone, 'quiet');
  phone.clock.now = '2026-03-11T08:00:00.000Z';
  await phone.repo.recordAnswer(brave, true, 'scheduled');
  await phone.repo.recordAnswer(calm, false, 'scheduled');
  await phone.repo.recordAnswer(calm, true, 'practice');
  await phone.db.cards.update(calm, { box: 5 });
  phone.clock.now = '2026-03-12T08:00:00.000Z';
  await phone.repo.recordAnswer(calm, true, 'scheduled'); // mastered
  const card = (await phone.repo.getCard(brave))!;
  await phone.repo.editCard(brave, {
    word: 'Brave',
    synonyms: [{ id: card.synonyms[0].id, text: 'bold' }], // "daring" removed
    meanings: card.meanings.map(({ id, text }) => ({ id, text })),
    sentences: card.sentences.map(({ id, text }) => ({ id, text })),
  });
  return phone;
}

describe('export and import: round trip (roadmap 7.12 Definition of Done)', () => {
  let phone: Box;
  beforeEach(async () => {
    phone = await filledBox();
  });

  it('a backup restored into an empty box gives back exactly the same box', async () => {
    const backup = await throughFile(phone);
    const fresh = await box(false);
    fresh.clock.now = '2026-04-01T08:00:00.000Z';

    expect(await fresh.repo.importBackup(backup, 'u1')).toEqual({
      status: 'imported',
      wordsAdded: 3,
      wordsUpdated: 0,
    });
    expect(await tables(fresh.db)).toEqual(await tables(phone.db));
    // The name and time zone come back too, so "today" is right.
    expect(await fresh.repo.getProfile()).toMatchObject({
      userId: 'u1',
      displayName: 'Yali',
      timeZone: 'Asia/Tehran',
    });
    // And the restored box exports the same backup again.
    const again = await fresh.repo.exportBackup('u1');
    expect({ ...again, exportedAt: '' }).toEqual({ ...backup, exportedAt: '' });
  });

  it('keeps the streak and words learned', async () => {
    const before = await phone.repo.progress();
    const fresh = await box();
    await fresh.repo.importBackup(await throughFile(phone), 'u1');
    fresh.clock.now = phone.clock.now;
    expect(await fresh.repo.progress()).toEqual(before);
    expect(before.wordsLearned).toBe(1);
  });

  it('importing the same file twice changes nothing the second time', async () => {
    const backup = await throughFile(phone);
    const fresh = await box();
    await fresh.repo.importBackup(backup, 'u1');
    const after = await tables(fresh.db);
    await fresh.db.outbox.clear();

    expect(await fresh.repo.importBackup(backup, 'u1')).toEqual({
      status: 'imported',
      wordsAdded: 0,
      wordsUpdated: 0,
    });
    expect(await tables(fresh.db)).toEqual(after);
    expect(await fresh.db.outbox.count()).toBe(0);
  });

  it('queues everything for the cloud; the next sync uploads it in the right order', async () => {
    const backup = await throughFile(phone);
    const fresh = await box();
    await fresh.repo.importBackup(backup, 'u1');
    const cloud = createFakeCloud();
    await createSync(fresh.db, cloud, { now: () => fresh.clock.now }).run();

    expect(cloud.tables.cards.size).toBe(3);
    expect(cloud.tables.card_entries.size).toBe(backup.entries.length);
    expect(cloud.tables.review_logs.size).toBe(4);
    expect(cloud.tables.streak_days.size).toBe(backup.streakDays.length);
    expect(await fresh.db.outbox.count()).toBe(0);
  });
});

describe('import into a box that already has words', () => {
  it('the newer edit of a word wins, in either direction', async () => {
    const phone = await box();
    const brave = await add(phone, 'brave');
    const calm = await add(phone, 'calm');
    const backup = await throughFile(phone);

    // After the backup: "brave" edited on the phone (newer than the file)…
    phone.clock.now = '2026-03-12T08:00:00.000Z';
    await phone.db.cards.update(brave, { box: 3, updatedAt: phone.clock.now });
    // …and "calm" older on the phone than in the file.
    await phone.db.cards.update(calm, { box: 4, updatedAt: '2026-03-01T08:00:00.000Z' });

    expect(await phone.repo.importBackup(backup, 'u1')).toEqual({
      status: 'imported',
      wordsAdded: 0,
      wordsUpdated: 1,
    });
    expect((await phone.db.cards.get(brave))?.box).toBe(3);
    expect((await phone.db.cards.get(calm))?.box).toBe(1);
  });

  it('a word that exists under another card: that card stays, lists combined, history moved', async () => {
    const old = await box();
    const fromFile = await add(old, 'brave', ['bold', 'daring']);
    old.clock.now = '2026-03-11T08:00:00.000Z';
    await old.repo.recordAnswer(fromFile, true, 'scheduled');
    const backup = await throughFile(old);

    const phone = await box();
    const mine = await add(phone, 'Brave', ['bold', 'fearless']);
    await phone.db.cards.update(mine, { box: 4 });

    expect(await phone.repo.importBackup(backup, 'u1')).toMatchObject({ wordsAdded: 0 });
    expect(await phone.db.cards.count()).toBe(1);
    const card = (await phone.repo.getCard(mine))!;
    expect(card.card.box).toBe(4);
    expect(card.synonyms.map((e) => e.text)).toEqual(['bold', 'fearless', 'daring']);
    // Same sentence ignoring capitals: kept once (the sync merge rule).
    expect(card.sentences.map((e) => e.text)).toEqual(['A Brave sentence.']);
    expect((await phone.db.reviewLogs.toArray()).map((l) => l.cardId)).toEqual([mine]);
    expect((await phone.repo.progress()).wordsLearned).toBe(1);
  });

  it('keeps this device’s name and time zone when it has them', async () => {
    const phone = await filledBox();
    const backup = {
      ...(await throughFile(phone)),
      profile: { displayName: 'Old', timeZone: 'UTC' },
    };
    await phone.repo.importBackup(backup, 'u1');
    expect(await phone.repo.getProfile()).toMatchObject({ displayName: 'Yali' });
  });

  it('a deleted word in the file comes back deleted and is not counted', async () => {
    const phone = await box();
    const brave = await add(phone, 'brave');
    await phone.db.cards.update(brave, { deletedAt: phone.clock.now });
    const fresh = await box();
    expect(await fresh.repo.importBackup(await throughFile(phone), 'u1')).toMatchObject({
      wordsAdded: 0,
    });
    expect((await fresh.db.cards.get(brave))?.deletedAt).toBe(phone.clock.now);
    expect(await fresh.repo.countCards()).toBe(0);
  });

  it('refuses a backup from another account and saves nothing', async () => {
    const phone = await filledBox();
    const backup = { ...(await throughFile(phone)), userId: 'someone-else' };
    const fresh = await box();
    expect(await fresh.repo.importBackup(backup, 'u1')).toEqual({ status: 'otherAccount' });
    expect(await fresh.db.cards.count()).toBe(0);
    expect(await fresh.db.outbox.count()).toBe(0);
  });
});

describe('backupStatus: when the modals show', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const later = (start: string, days: number) =>
    new Date(Date.parse(start) + days * DAY).toISOString();

  it('normally neither shows', async () => {
    const phone = await box();
    expect(await phone.repo.backupStatus()).toEqual({ saveReminder: false, restoreOffer: false });
    await add(phone, 'brave');
    expect(await phone.repo.backupStatus()).toEqual({ saveReminder: false, restoreOffer: false });
  });

  it('"Save a copy?" after 14 days without the cloud while changes wait; "Not now" waits 7 days', async () => {
    const phone = await box();
    const start = phone.clock.now;
    await phone.db.meta.put({ key: META.lastSyncedAt, value: start });
    await add(phone, 'brave');

    phone.clock.now = later(start, 13);
    expect((await phone.repo.backupStatus()).saveReminder).toBe(false);
    phone.clock.now = later(start, 14);
    expect((await phone.repo.backupStatus()).saveReminder).toBe(true);

    await phone.repo.snoozeBackup('save');
    phone.clock.now = later(start, 20);
    expect((await phone.repo.backupStatus()).saveReminder).toBe(false);
    phone.clock.now = later(start, 21);
    expect((await phone.repo.backupStatus()).saveReminder).toBe(true);
  });

  it('"Restore your words?" when the box is empty and the cloud cannot be reached', async () => {
    const phone = await box();
    expect((await phone.repo.backupStatus()).restoreOffer).toBe(false);
    await phone.db.meta.put({ key: META.lastSyncFailedAt, value: phone.clock.now });
    expect((await phone.repo.backupStatus()).restoreOffer).toBe(true);

    await phone.repo.snoozeBackup('restore');
    expect((await phone.repo.backupStatus()).restoreOffer).toBe(false);
  });
});
