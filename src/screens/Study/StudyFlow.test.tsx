// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb, META } from '../../data/db';
import { createRepository, type Repository } from '../../data/repository';
import { StudyFlow } from './StudyFlow';

const DAY_1 = '2026-03-10T08:00:00.000Z';
const DAY_2 = '2026-03-11T08:00:00.000Z';

let db: LeitnerDb;
let repo: Repository;
let now: string;

// jsdom has no pointer capture; the gesture library calls it.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

beforeEach(async () => {
  // "Reduce motion" on: answers apply at once instead of after the fly-out animation.
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  db = new LeitnerDb(`test-${crypto.randomUUID()}`);
  now = DAY_1;
  repo = createRepository(db, { now: () => now, newId: () => crypto.randomUUID() });
  await repo.saveProfile({
    userId: 'u1',
    displayName: 'Yali',
    timeZone: 'Asia/Tehran',
    updatedAt: now,
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

/** Adds cards on day 1; they are due on day 2. */
async function addCards(...words: string[]) {
  for (const word of words) {
    const result = await repo.addCard({
      word,
      synonyms: [{ text: `${word}-like` }],
      meanings: [{ text: 'معنی' }],
      sentences: [{ text: `A ${word} sentence about ${word.toUpperCase()}.` }],
    });
    if (result.status !== 'created') throw new Error('not created');
  }
}

const wordsLike = (count: number) => Array.from({ length: count }, (_, i) => `word${i + 1}`);

async function boxOf(word: string) {
  const card = await db.cards.filter((c) => c.word === word).first();
  return card?.box;
}

/** The word on the card front (a big button). */
async function frontWord() {
  const button = await screen.findByRole('button', { name: /tap to flip/ });
  return within(button).getByText(
    (_, el) =>
      el?.tagName === 'SPAN' &&
      /^word|^brave|^calm|^quiet/.test(el.textContent ?? '') &&
      el.children.length === 0,
  ).textContent;
}

/** On Today, tap the Vocab deck card to start (or continue) its session. */
async function startVocab() {
  await userEvent.click(await screen.findByRole('button', { name: /^Vocab, .*(Start|Continue)$/ }));
}

async function flipAndAnswer(answer: 'Knew it!' | 'Not yet') {
  await userEvent.click(await screen.findByRole('button', { name: /tap to flip/ }));
  await userEvent.click(await screen.findByRole('button', { name: answer }));
}

describe('StudyFlow', () => {
  it('opens on Today: the greeting, the DJ and "Mix them all", an empty Vocab deck adds words', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(await screen.findByRole('heading', { name: 'Hi Yali!' })).toBeInTheDocument();
    expect(screen.getByText('What shall we study today?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The mascot as a DJ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mix them all/ })).toBeInTheDocument();
    const deck = screen.getByRole('button', { name: 'Vocab, empty. Add words' });
    expect(deck).toHaveTextContent('Empty');
    await userEvent.click(deck);
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    expect(within(sheet).getByText('Vocab')).toBeInTheDocument();
  });

  it('a deck with nothing due says "All done for today"; tapping it offers Add', async () => {
    await addCards('brave'); // due tomorrow
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    const deck = await screen.findByRole('button', { name: 'Vocab, all done for today' });
    expect(within(deck).getByText('All done for today')).toBeInTheDocument();
    await userEvent.click(deck);
    const sheet = await screen.findByRole('dialog', { name: 'Vocab' });
    expect(within(sheet).getByText('All done for today ✓')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add vocab' }));
    expect(await screen.findByRole('dialog', { name: 'New word' })).toBeInTheDocument();
  });

  it('"Mix them all" with nothing due and nothing new today shows "All done for today"', async () => {
    await addCards('brave');
    now = DAY_2;
    await db.cards.toCollection().modify({ dueDate: '2026-03-20' });
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: /Mix them all/ }));
    expect(await screen.findByRole('heading', { name: 'All done for today' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByRole('heading', { name: 'Hi Yali!' })).toBeInTheDocument();
  });

  it('a deck with cards due shows how many wait; "Mix them all" starts them', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(
      await screen.findByRole('button', { name: 'Vocab, 2 waiting. Start' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 cards from all decks')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mix them all/ }));
    expect(await screen.findByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
  });

  it('Mix them all shows the deck chip by the progress bar; Home and Mix again carry on', async () => {
    await addCards('brave', 'calm', 'quiet');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: /Mix them all/ }));
    const bar = await screen.findByRole('progressbar', { name: 'Session progress' });
    expect(within(bar.parentElement!).getByText('Vocab')).toBeInTheDocument();
    await flipAndAnswer('Not yet');
    await screen.findByRole('button', { name: /tap to flip/ });

    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByText('Paused · 3 left')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mix them all/ }));
    await flipAndAnswer('Knew it!');
    await flipAndAnswer('Knew it!');
    expect(await screen.findByText('Practice round')).toBeInTheDocument();
    await flipAndAnswer('Knew it!');
    expect(await screen.findByRole('heading', { name: 'Session complete!' })).toBeInTheDocument();
    expect(screen.getByText('You went through 3 words. Nice work.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done for today' }));
    expect(
      await screen.findByRole('button', { name: 'Vocab, all done for today' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Paused/)).not.toBeInTheDocument();
  });

  it('a single deck session shows no deck chip', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    const bar = await screen.findByRole('progressbar', { name: 'Session progress' });
    expect(within(bar.parentElement!).queryByText('Vocab')).not.toBeInTheDocument();
  });

  it('extra practice from a finished deck: never moves a card; missed ones can go again (N3, N11, N12)', async () => {
    await addCards('brave', 'calm'); // added today, due tomorrow
    const before = (await db.cards.toArray()).map((c) => [c.id, c.box, c.dueDate]);
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vocab, all done for today' }));
    const sheet = await screen.findByRole('dialog', { name: 'Vocab' });
    const practice = within(sheet).getByRole('button', { name: /Practice today's new words/ });
    expect(practice).toHaveTextContent('2');
    await userEvent.click(practice);

    expect(await screen.findByText('Practice · your boxes stay the same')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
    expect(screen.getByText("today's new words")).toBeInTheDocument();
    expect(
      screen.getByText('Just for fun: answers here never move your cards'),
    ).toBeInTheDocument();
    const missed = await frontWord();
    await flipAndAnswer('Not yet');
    expect(await screen.findByText('1 left')).toBeInTheDocument();
    await flipAndAnswer('Knew it!');

    expect(await screen.findByRole('heading', { name: 'Practice done!' })).toBeInTheDocument();
    expect(
      screen.getByText('You missed 1. Want one more go at just that one?'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Practice it again' }));
    expect(await frontWord()).toBe(missed);
    await flipAndAnswer('Knew it!');
    expect(await screen.findByText('You knew every one.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { name: 'Hi Yali!' })).toBeInTheDocument();

    // Nothing moved; every answer was logged as practice.
    expect((await db.cards.toArray()).map((c) => [c.id, c.box, c.dueDate])).toEqual(before);
    expect((await db.reviewLogs.toArray()).every((log) => log.isPractice)).toBe(true);
    expect(await db.reviewLogs.count()).toBe(3);
  });

  it('a finished deck with no words added today offers only Add', async () => {
    await addCards('brave');
    now = DAY_2;
    await db.cards.toCollection().modify({ dueDate: '2026-03-20' });
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Vocab, all done for today' }));
    const sheet = await screen.findByRole('dialog', { name: 'Vocab' });
    expect(within(sheet).queryByRole('button', { name: /Practice/ })).not.toBeInTheDocument();
  });

  it('"Mix them all" with nothing due practises today\'s new words; Done goes Home', async () => {
    await addCards('brave');
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: /Mix them all/ }));
    expect(await screen.findByText('Practice · your boxes stay the same')).toBeInTheDocument();
    await flipAndAnswer('Knew it!');
    await userEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { name: 'Hi Yali!' })).toBeInTheDocument();
  });

  it('Home pauses a session (no "are you sure?"); Continue carries on, practice round included', async () => {
    await addCards('brave', 'calm', 'quiet');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    const missed = await frontWord();
    await flipAndAnswer('Not yet');
    await screen.findByRole('button', { name: /tap to flip/ });

    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const deck = await screen.findByRole('button', { name: 'Vocab, paused · 3 left. Continue' });
    await userEvent.click(deck);

    await flipAndAnswer('Knew it!');
    await flipAndAnswer('Knew it!');
    expect(await screen.findByText('Practice round')).toBeInTheDocument();
    expect(await frontWord()).toBe(missed);
    await flipAndAnswer('Knew it!');
    expect(await screen.findByRole('heading', { name: 'Session complete!' })).toBeInTheDocument();
    expect(screen.getByText('You went through 3 words. Nice work.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done for today' }));
    expect(
      await screen.findByRole('button', { name: 'Vocab, all done for today' }),
    ).toBeInTheDocument();
  });

  it('shows the loading screen with the name first', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={60_000} />);
    expect(await screen.findByRole('heading', { name: "Yali's Leitner." })).toBeInTheDocument();
  });

  it('shows the streak pill on the loading screen once there is a streak', async () => {
    await db.streakDays.bulkAdd(
      ['2026-03-08', '2026-03-09'].map((day) => ({ day, id: day, createdAt: now })),
    );
    render(<StudyFlow repo={repo} minLoadingMs={60_000} />);
    // The 10th is not earned yet: the streak still shows the run up to yesterday.
    expect(await screen.findByText('2 days in a row')).toBeInTheDocument();
  });

  it('hides the loading streak pill while the streak is 0', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={60_000} />);
    await screen.findByRole('heading', { name: "Yali's Leitner." });
    expect(screen.queryByText(/in a row/)).not.toBeInTheDocument();
  });

  it('shows every card in the box and the streak in the top bar, and the streak on Session complete', async () => {
    await addCards('brave', 'calm'); // day 1: nothing was due, a word was added → streak 1
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(await screen.findByText('2 cards in your box')).toBeInTheDocument();
    expect(screen.getByText('1-day streak')).toBeInTheDocument();

    await startVocab();
    await flipAndAnswer('Knew it!');
    await flipAndAnswer('Not yet');
    await flipAndAnswer('Knew it!'); // practice: changes nothing

    // Both due cards were reviewed: day 2 counts too.
    expect(await screen.findByText(/2 days in a row!/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done for today' }));
    // The badge counts every card, whatever its box.
    expect(await screen.findByText('2 cards in your box')).toBeInTheDocument();
    expect(screen.getByText('2-day streak')).toBeInTheDocument();
  });

  it('the box badge opens the all-words page; Back returns to where you were', async () => {
    await addCards('brave');
    now = '2026-03-10T09:00:00.000Z';
    await addCards('calm');
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: '2 cards in your box' }));
    expect(await screen.findByRole('heading', { name: /In your box/ })).toBeInTheDocument();
    // By day, newest first.
    const words = await screen.findAllByRole('button', { name: /Box 1 of 5/ });
    expect(words.map((b) => b.textContent?.split(/[^a-z]/)[0])).toEqual(['calm', 'brave']);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: '2 cards in your box' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /In your box/ })).not.toBeInTheDocument();
  });

  it('all words: tap a row for the card view with Edit; delete with Undo; practise a day', async () => {
    await addCards('brave', 'calm');
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: '2 cards in your box' }));
    await userEvent.click(await screen.findByRole('button', { name: /^brave/ }));
    expect(await screen.findByLabelText('Your card: brave')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit word' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    const row = await screen.findByRole('button', { name: /^calm/ });
    row.focus();
    await userEvent.keyboard('{Delete}');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('calm deleted'));
    expect(await screen.findByText('1 card')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('2 cards')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Practice words added today' }));
    expect(await screen.findByText('Practice · your boxes stay the same')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('the all-words page of an empty box says so', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: '0 cards in your box' }));
    expect(await screen.findByText('Your box is empty', { selector: 'p' })).toBeInTheDocument();
  });

  it('shows one Loading screen, already with the name (never a nameless "Leitner" first)', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={60_000} />);
    expect(await screen.findByRole('heading', { name: "Yali's Leitner." })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Leitner.' })).not.toBeInTheDocument();
  });

  it('restoring a backup keeps "Your words are back!" open while the review starts behind it', async () => {
    // A backup made by another device of the same account.
    const other = new LeitnerDb(`test-${crypto.randomUUID()}`);
    const source = createRepository(other, { now: () => DAY_1, newId: () => crypto.randomUUID() });
    await source.addCard({
      word: 'brave',
      synonyms: [{ text: 'bold' }],
      meanings: [{ text: 'شجاع' }],
      sentences: [{ text: 'She was brave.' }],
    });
    const file = new File([JSON.stringify(await source.exportBackup('u1'))], 'b.json', {
      type: 'application/json',
    });
    await other.delete();

    // This phone lost its words and can't reach the cloud.
    await db.meta.put({ key: META.lastSyncFailedAt, value: DAY_1 });
    now = DAY_2;
    render(<StudyFlow repo={repo} userId="u1" minLoadingMs={0} />);
    await userEvent.upload(
      await screen.findByLabelText('Backup file', { selector: 'input' }),
      file,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));

    expect(await screen.findByRole('dialog', { name: 'Your words are back!' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      await screen.findByRole('button', { name: 'Vocab, 1 waiting. Start' }),
    ).toBeInTheDocument();
  });

  it('shows the front, then the back after a tap', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();

    expect(await frontWord()).toBe('brave');
    expect(screen.getByText('do you know it?')).toBeInTheDocument();
    expect(screen.getByText('Think first…')).toBeInTheDocument();
    // No answers on the front.
    expect(screen.queryByRole('button', { name: 'Knew it!' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /tap to flip/ }));
    const back = screen.getByLabelText('Answer for brave');
    expect(back).toHaveFocus();
    expect(within(back).getByText('brave-like')).toBeInTheDocument();
    expect(within(back).getByText('معنی').closest('[lang]')).toHaveAttribute('lang', 'fa');
    // The word is marked inside the sentence, whatever its case.
    expect(within(back).getAllByText(/^brave$/i, { selector: 'mark' })).toHaveLength(2);
  });

  it('runs a session: right answers move up, a miss comes back as practice that changes nothing', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();

    await flipAndAnswer('Knew it!');
    await flipAndAnswer('Not yet');

    // Practice round: the missed card once more.
    expect(await screen.findByText('Practice round')).toBeInTheDocument();
    expect(screen.getByText('1 left')).toBeInTheDocument();
    expect(screen.getByText('one more look')).toBeInTheDocument();
    const missed = (await db.cards.toArray()).find((card) => card.box === 1)!;
    const before = await repo.getCard(missed.id);
    await flipAndAnswer('Knew it!');

    expect(await screen.findByRole('heading', { name: 'Session complete!' })).toBeInTheDocument();
    expect(screen.getByText('You went through 2 words. Nice work.')).toBeInTheDocument();
    // No score, and no "Next" when nothing else is due.
    expect(screen.queryByText(/of 2/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument();
    // The practice answer did not move the card.
    expect((await repo.getCard(missed.id))?.card).toEqual(before?.card);
    expect([await boxOf('brave'), await boxOf('calm')].sort()).toEqual([1, 2]);

    await userEvent.click(screen.getByRole('button', { name: 'Done for today' }));
    expect(
      await screen.findByRole('button', { name: 'Vocab, all done for today' }),
    ).toBeInTheDocument();
  });

  it('offers the next cards when more are due; stopping goes back to Today', async () => {
    await addCards(...wordsLike(23));
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();

    for (let i = 0; i < 20; i++) await flipAndAnswer('Knew it!');
    expect(await screen.findByRole('heading', { name: 'Session complete!' })).toBeInTheDocument();
    expect(screen.getByText('You went through 20 words. Nice work.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Next 3 words' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: "I'm done for now" }));
    await userEvent.click(await screen.findByRole('button', { name: 'Vocab, 3 waiting. Start' }));
    expect(await screen.findByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
  });

  it('keeps unanswered cards due when you leave mid-session', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    const view = render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    await flipAndAnswer('Knew it!');
    await screen.findByRole('button', { name: /tap to flip/ });
    view.unmount();

    expect((await repo.deckStatuses(['vocab']))[0]).toMatchObject({ waiting: 1, pausedLeft: 1 });
  });

  it('answers with a swipe on the back, but not on the front', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    const first = (await frontWord())!;

    // Dragging the front does nothing.
    swipe(screen.getByRole('button', { name: /tap to flip/ }), 150);
    expect(await frontWord()).toBe(first);

    // A short drag on the back springs back…
    await userEvent.click(screen.getByRole('button', { name: /tap to flip/ }));
    swipe(screen.getByLabelText(`Answer for ${first}`), 30);
    expect(await boxOf(first)).toBe(1);
    expect(screen.getByLabelText(`Answer for ${first}`)).toBeInTheDocument();

    // …a long one to the right answers "Knew it".
    swipe(screen.getByLabelText(`Answer for ${first}`), 150);
    await screen.findByRole('button', { name: /tap to flip/ });
    expect(await boxOf(first)).toBe(2);
  });
  it('adds a word from the top bar mid-session; ✕ goes back to the same card', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    const front = await screen.findByRole('button', { name: /tap to flip/ });
    const word = front.textContent;

    // One deck enabled: + opens its add sheet straight away (no roll-out).
    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    expect(within(sheet).getByText('Vocab')).toBeInTheDocument();
    await userEvent.type(within(sheet).getByLabelText('The word'), 'Calm');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save word' }));
    expect(await within(sheet).findByText('Already in your Vocab box')).toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect((await screen.findByRole('button', { name: /tap to flip/ })).textContent).toBe(word);
  });

  it("a sentence's Persian is hidden until tapped; tapping never flips back or answers (P2)", async () => {
    await addCards('brave', 'calm');
    for (const card of await db.cards.toArray()) {
      const entries = await db.entries.where('cardId').equals(card.id).toArray();
      const sentence = entries.find((e) => e.kind === 'sentence')!;
      await db.entries.update(sentence.id, { translation: `فارسی ${card.word}` });
    }
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    const first = await frontWord();
    await userEvent.click(screen.getByRole('button', { name: /tap to flip/ }));
    const back = screen.getByLabelText(`Answer for ${first}`);
    const sentence = within(back).getByRole('button', { name: /Persian translation hidden/ });
    expect(sentence).toHaveAttribute('aria-expanded', 'false');
    expect(within(back).getByText('fa')).toBeInTheDocument();
    expect(within(back).queryByText(`فارسی ${first}`)).not.toBeInTheDocument();

    await userEvent.click(sentence);
    expect(sentence).toHaveAttribute('aria-expanded', 'true');
    expect(within(back).getByText(`فارسی ${first}`)).toHaveAttribute('lang', 'fa');
    // Still the same card's back, nothing answered.
    expect(screen.getByLabelText(`Answer for ${first}`)).toBeInTheDocument();
    expect(await boxOf(first!)).toBe(1);
    await userEvent.click(sentence);
    expect(within(back).queryByText(`فارسی ${first}`)).not.toBeInTheDocument();

    // Open it again, answer: the next card starts hidden.
    await userEvent.click(sentence);
    await userEvent.click(screen.getByRole('button', { name: 'Knew it!' }));
    const second = await frontWord();
    await userEvent.click(screen.getByRole('button', { name: /tap to flip/ }));
    expect(
      within(screen.getByLabelText(`Answer for ${second}`)).queryByText(`فارسی ${second}`),
    ).not.toBeInTheDocument();
  });

  it('a sentence without Persian has no pill and is not a button', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    await userEvent.click(await screen.findByRole('button', { name: /tap to flip/ }));
    const back = screen.getByLabelText('Answer for brave');
    expect(within(back).queryByText('fa')).not.toBeInTheDocument();
    expect(within(back).queryByRole('button', { name: /sentence/i })).not.toBeInTheDocument();
  });

  it('edits the card being reviewed with the pencil, and shows the change at once', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    await userEvent.click(await screen.findByRole('button', { name: /tap to flip/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit word' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit word' });
    const synonym = within(sheet).getByLabelText('Similar words');
    await userEvent.clear(synonym);
    await userEvent.type(synonym, 'fearless');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await within(screen.getByLabelText('Answer for brave')).findByText('fearless'),
    ).toBeInTheDocument();
  });
});

describe('StudyFlow with a keyboard (laptop, roadmap 7.13)', () => {
  beforeEach(async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    await screen.findByRole('button', { name: /tap to flip/ });
  });

  it('Space flips, → is "Knew it!", ← is "Not yet"', async () => {
    const first = await frontWord();
    await userEvent.keyboard(' ');
    expect(await screen.findByLabelText(`Answer for ${first}`)).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');

    const second = await frontWord();
    expect(second).not.toBe(first);
    await userEvent.keyboard(' ');
    await screen.findByLabelText(`Answer for ${second}`);
    await userEvent.keyboard('{ArrowLeft}');

    expect(await boxOf(first!)).toBe(2);
    expect(await boxOf(second!)).toBe(1);
    expect(await screen.findByText('Practice round')).toBeInTheDocument();
  });

  it('arrows and E do nothing on the front (no answering or editing before you flip)', async () => {
    const word = await frontWord();
    await userEvent.keyboard('{ArrowRight}e');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await boxOf(word!)).toBe(1);
    expect(screen.getByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
  });

  it('E edits the card on the back; typing in the sheet is not a shortcut; Esc closes it', async () => {
    const word = await frontWord();
    await userEvent.keyboard(' ');
    await screen.findByLabelText(`Answer for ${word}`);
    await userEvent.keyboard('e');

    const sheet = await screen.findByRole('dialog', { name: 'Edit word' });
    const synonym = within(sheet).getByLabelText('Similar words');
    expect(synonym).toHaveValue(`${word}-like`); // no stray "e" typed in
    await userEvent.type(synonym, ' e {ArrowLeft}{ArrowRight}');
    expect(await boxOf(word!)).toBe(1); // the arrows moved the text cursor, not the card

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText(`Answer for ${word}`)).toBeInTheDocument();
  });

  it('after answering with the keyboard, focus moves to the next card (not lost)', async () => {
    const first = await frontWord();
    await userEvent.keyboard(' ');
    await screen.findByLabelText(`Answer for ${first}`);
    screen.getByRole('button', { name: 'Knew it!' }).focus();
    await userEvent.keyboard('{Enter}');

    const next = await screen.findByRole('button', { name: /tap to flip/ });
    await waitFor(() => expect(next).toHaveFocus());
    expect(await frontWord()).not.toBe(first);
  });

  it('after the last keyboard answer, focus moves to "Session complete!"', async () => {
    for (let i = 0; i < 2; i++) {
      const word = await frontWord();
      await userEvent.keyboard(' ');
      await screen.findByLabelText(`Answer for ${word}`);
      screen.getByRole('button', { name: 'Knew it!' }).focus();
      await userEvent.keyboard('{Enter}');
    }
    const title = await screen.findByRole('heading', { name: 'Session complete!' });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('leaves browser shortcuts alone (Ctrl / ⌘ held)', async () => {
    const word = await frontWord();
    await userEvent.keyboard(' ');
    await screen.findByLabelText(`Answer for ${word}`);
    await userEvent.keyboard('{Control>}{ArrowRight}{/Control}{Meta>}e{/Meta}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await boxOf(word!)).toBe(1);
  });
});

/** Drag horizontally by dx px (the gesture library captures the pointer, so moves arrive on the card). */
let pointerId = 0;
function swipe(element: Element, dx: number) {
  const target = element.parentElement!.closest('[style]') ?? element;
  pointerId += 1;
  const start = {
    pointerId,
    clientX: 100,
    clientY: 100,
    buttons: 1,
    isPrimary: true,
    pointerType: 'touch',
  };
  fireEvent.pointerDown(target, start);
  for (let step = 1; step <= 5; step++) {
    fireEvent.pointerMove(target, { ...start, clientX: 100 + (dx * step) / 5 });
  }
  fireEvent.pointerUp(target, { ...start, clientX: 100 + dx, buttons: 0 });
}

describe('laptop shortcuts N / H / / (v3 brief 1.12)', () => {
  it('N opens the add sheet (one deck on); typing an "n" or "h" in it is just typing', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await screen.findByRole('heading', { name: 'Hi Yali!' });
    await userEvent.keyboard('n');
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    await userEvent.type(within(sheet).getByLabelText('The word'), 'nh');
    expect(within(sheet).getByLabelText('The word')).toHaveValue('nh');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('H goes Home from a session; with Ctrl or ⌘ held nothing happens', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await startVocab();
    await screen.findByRole('button', { name: /tap to flip/ });
    await userEvent.keyboard('{Control>}h{/Control}{Meta>}n{/Meta}');
    expect(screen.getByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.keyboard('H');
    expect(await screen.findByRole('heading', { name: 'Hi Yali!' })).toBeInTheDocument();
  });

  it('/ focuses the search on all words; H leaves the page', async () => {
    await addCards('brave');
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await userEvent.click(await screen.findByRole('button', { name: '1 card in your box' }));
    await screen.findByRole('heading', { name: 'In your box' });
    await userEvent.keyboard('/');
    const search = screen.getByRole('searchbox', { name: 'Search words' });
    expect(search).toHaveFocus();
    await userEvent.keyboard('h'); // typed into the search, not a shortcut
    expect(search).toHaveValue('h');
    search.blur();
    await userEvent.keyboard('h');
    expect(await screen.findByRole('heading', { name: 'Hi Yali!' })).toBeInTheDocument();
  });

  it('keys do nothing while a sheet is open', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await screen.findByRole('heading', { name: 'Hi Yali!' });
    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    sheet.focus();
    await userEvent.keyboard('h');
    expect(screen.getByRole('dialog', { name: 'New word' })).toBeInTheDocument();
  });
});
