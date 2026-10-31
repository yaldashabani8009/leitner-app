import { useEffect, useState } from 'react';
import { dateInZone } from '../domain/time/zonedDate';
import { LeitnerDb, META } from '../data/db';
import { createRepository, type Repository } from '../data/repository';
import { SessionComplete } from '../screens/Rest/RestScreens';
import { StudyFlow } from '../screens/Study/StudyFlow';

/**
 * Dev-only: the real study screens with sample words (roadmap 7.9 screenshots).
 * Open http://localhost:5173/leitner-app/?demo (add &empty for an empty box, &many for 23 words,
 * &complete for Session complete with a streak bubble). Unless &empty, it starts with a 12-day
 * streak (up to yesterday) and the sample words already learned once.
 * &backup=save shows "Save a copy?" (20 days without the cloud); &empty&backup=restore shows
 * "Have a backup file?" (empty box, cloud unreachable). &reminder offers "Want a daily reminder?"
 * after "Done for today" (with a fake cloud; the browser still needs push support).
 * Uses its own on-device database that is never synced; main.tsx only loads this in dev.
 */
export function DemoPage() {
  const [repo, setRepo] = useState<Repository | null>(null);

  useEffect(() => {
    void ready.then(setRepo);
  }, []);

  if (params.has('complete')) {
    return (
      <SessionComplete
        wordCount={20}
        nextCount={20}
        streak={13}
        onNext={() => {}}
        onDone={() => {}}
      />
    );
  }

  return repo ? (
    <StudyFlow
      repo={repo}
      userId="demo"
      reminders={params.has('reminder') ? demoReminders : undefined}
      onSignOut={() => alert('Sign out (demo)')}
    />
  ) : null;
}

const WORDS = [
  {
    word: 'meticulous',
    synonyms: ['careful', 'precise', 'thorough'],
    meanings: ['دقیق', 'وسواسی، موشکاف'],
    sentences: [
      'She keeps meticulous notes in every meeting.',
      'The repair needed meticulous work.',
    ],
  },
  {
    word: 'reluctant',
    synonyms: ['unwilling', 'hesitant'],
    meanings: ['بی‌میل', 'مردد'],
    sentences: ['He was reluctant to leave the party early.'],
  },
  {
    word: 'brave',
    synonyms: ['bold', 'daring'],
    meanings: ['شجاع'],
    sentences: ['It was a brave thing to say.'],
  },
];

const params = new URLSearchParams(location.search);

/** A pretend cloud for the reminder offer: nothing is saved or sent. */
let demoSettings = { reminderTime: '19:00', remindersOn: true };
const demoReminders = {
  publicKey: async () => 'BAQIDBA',
  save: async () => {},
  sendTest: async () => {},
  settings: async () => ({ ...demoSettings }),
  saveSettings: async (_userId: string, change: Partial<typeof demoSettings>) => {
    demoSettings = { ...demoSettings, ...change };
  },
};
const demoDb = new LeitnerDb('leitner-dev-demo');
// Seeded once per page load (React runs effects twice in development).
const ready = seed(demoDb, params.has('empty'), params.has('many')).then(() =>
  createRepository(demoDb),
);

async function seed(db: LeitnerDb, empty: boolean, many: boolean) {
  await db.delete();
  await db.open();
  // Added "yesterday", so they are due today.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const past = createRepository(db, { now: () => yesterday, newId: () => crypto.randomUUID() });
  await past.saveProfile({
    userId: 'demo',
    displayName: 'Yali',
    timeZone: 'Asia/Tehran',
    updatedAt: yesterday,
  });
  if (params.get('backup') === 'restore') {
    await db.meta.put({ key: META.lastSyncFailedAt, value: yesterday });
  }
  if (params.get('backup') === 'save') {
    const longAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    await db.meta.put({ key: META.lastSyncedAt, value: longAgo });
  }
  if (empty) return;
  const fillers = many
    ? Array.from({ length: 20 }, (_, i) => ({
        word: `sample${i + 1}`,
        synonyms: ['example'],
        meanings: ['نمونه'],
        sentences: [`This is sample${i + 1}.`],
      }))
    : [];
  const ids: string[] = [];
  for (const card of [...WORDS, ...fillers]) {
    const result = await past.addCard({
      word: card.word,
      synonyms: card.synonyms.map((text) => ({ text })),
      meanings: card.meanings.map((text) => ({ text })),
      sentences: card.sentences.map((text) => ({ text })),
    });
    if (result.status === 'created') ids.push(result.cardId);
  }

  // Top-bar numbers: the sample words passed box 1 once before, and the 12 days before today
  // earned the streak (written straight to the demo database; it is never synced).
  const day = (daysAgo: number) =>
    new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  await db.streakDays.clear();
  await db.streakDays.bulkAdd(
    Array.from({ length: 12 }, (_, i) => ({
      day: dateInZone(day(i + 1), 'Asia/Tehran'),
      id: crypto.randomUUID(),
      createdAt: yesterday,
    })),
  );
  await db.reviewLogs.bulkAdd(
    ids.map((cardId) => ({
      id: crypto.randomUUID(),
      cardId,
      reviewedAt: day(5),
      correct: true,
      boxBefore: 1 as const,
      boxAfter: 2 as const,
      isPractice: false,
      createdAt: day(5),
    })),
  );
}
