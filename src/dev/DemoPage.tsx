import { useEffect, useState } from 'react';
import { LeitnerDb } from '../data/db';
import { createRepository, type Repository } from '../data/repository';
import { StudyFlow } from '../screens/Study/StudyFlow';

/**
 * Dev-only: the real study screens with sample words (roadmap 7.9 screenshots).
 * Open http://localhost:5173/leitner-app/?demo (add &empty for an empty box, &many for 23 words).
 * Uses its own on-device database that is never synced; main.tsx only loads this in dev.
 */
export function DemoPage() {
  const [repo, setRepo] = useState<Repository | null>(null);

  useEffect(() => {
    void ready.then(setRepo);
  }, []);

  return repo ? <StudyFlow repo={repo} /> : null;
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
  if (empty) return;
  const fillers = many
    ? Array.from({ length: 20 }, (_, i) => ({
        word: `sample${i + 1}`,
        synonyms: ['example'],
        meanings: ['نمونه'],
        sentences: [`This is sample${i + 1}.`],
      }))
    : [];
  for (const card of [...WORDS, ...fillers]) {
    await past.addCard({
      word: card.word,
      synonyms: card.synonyms.map((text) => ({ text })),
      meanings: card.meanings.map((text) => ({ text })),
      sentences: card.sentences.map((text) => ({ text })),
    });
  }
}
