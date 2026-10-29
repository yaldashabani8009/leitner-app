// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb } from '../../data/db';
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
  it('shows "Nothing to review yet" when the box is empty', async () => {
    render(<StudyFlow repo={repo} minLoadingMs={0} />);
    expect(
      await screen.findByRole('heading', { name: 'Nothing to review yet' }),
    ).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: "I'm done for now" }));
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
