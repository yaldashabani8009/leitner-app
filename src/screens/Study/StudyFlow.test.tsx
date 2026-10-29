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
      /^word|^brave|^calm/.test(el.textContent ?? '') &&
      el.children.length === 0,
  ).textContent;
}

async function flipAndAnswer(answer: 'Knew it!' | 'Not yet') {
  await userEvent.click(await screen.findByRole('button', { name: /tap to flip/ }));
  await userEvent.click(await screen.findByRole('button', { name: answer }));
}

describe('StudyFlow', () => {
  it('shows "Your box is empty" when the box is empty', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(await screen.findByRole('heading', { name: 'Your box is empty' })).toBeInTheDocument();
  });

  it('shows "All done for today" when no card is due yet', async () => {
    await addCards('brave'); // due tomorrow
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(await screen.findByRole('heading', { name: 'All done for today' })).toBeInTheDocument();
    expect(
      screen.getByText('Your next words will be ready tomorrow. Want to add a new one?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a new word' })).toBeInTheDocument();
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

  it('shows words learned and the streak in the top bar, and the streak on Session complete', async () => {
    await addCards('brave', 'calm'); // day 1: nothing was due, a word was added → streak 1
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(await screen.findByText('0 words learned')).toBeInTheDocument();
    expect(screen.getByText('1-day streak')).toBeInTheDocument();

    await flipAndAnswer('Knew it!');
    expect(await screen.findByText('1 word learned')).toBeInTheDocument();
    await flipAndAnswer('Not yet');
    await flipAndAnswer('Knew it!'); // practice: changes nothing

    // Both due cards were reviewed: day 2 counts too.
    expect(await screen.findByText(/2 days in a row!/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done for today' }));
    expect(await screen.findByText('1 word learned')).toBeInTheDocument();
    expect(screen.getByText('2-day streak')).toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
  });

  it('shows the front, then the back after a tap', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);

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
    expect(await screen.findByRole('heading', { name: 'All done for today' })).toBeInTheDocument();
  });

  it('offers the next cards when more are due, and a calm rest when you stop', async () => {
    await addCards(...wordsLike(23));
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);

    for (let i = 0; i < 20; i++) await flipAndAnswer('Knew it!');
    expect(await screen.findByRole('heading', { name: 'Session complete!' })).toBeInTheDocument();
    expect(screen.getByText('You went through 20 words. Nice work.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Next 3 words' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: "I'm done for now" }));
    expect(await screen.findByRole('heading', { name: 'Nice work!' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(await screen.findByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
  });

  it('keeps unanswered cards due when you leave mid-session', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    const view = render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await flipAndAnswer('Knew it!');
    await screen.findByRole('button', { name: /tap to flip/ });
    view.unmount();

    expect(await repo.nextSessionCardIds()).toHaveLength(1);
  });

  it('answers with a swipe on the back, but not on the front', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
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
  it('adds words from the top bar, and "Open my card" shows the card until Done', async () => {
    await addCards('brave', 'calm');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    await screen.findByRole('button', { name: /tap to flip/ });

    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));
    await userEvent.type(await screen.findByLabelText('The word'), 'Calm');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open my card' }));

    expect(await screen.findByLabelText('Your card: calm')).toBeInTheDocument();
    expect(
      screen.getByText("It's back at the start. You'll see it again tomorrow."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit word' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('button', { name: /tap to flip/ })).toBeInTheDocument();
  });

  it('edits the card being reviewed with the pencil, and shows the change at once', async () => {
    await addCards('brave');
    now = DAY_2;
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
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
