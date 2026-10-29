// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb } from '../../data/db';
import { createRepository, type Repository } from '../../data/repository';
import { AddEditSheet, type Editor } from './AddEditSheet';

const DAY_1 = '2026-03-10T08:00:00.000Z'; // the 10th in Tehran

let db: LeitnerDb;
let repo: Repository;
let now: string;

beforeEach(async () => {
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
  await db.delete();
});

async function existing(word = 'brave') {
  const result = await repo.addCard({
    word,
    synonyms: [{ text: 'bold' }, { text: 'daring' }],
    meanings: [{ text: 'شجاع' }],
    sentences: [{ text: 'She was brave.' }],
  });
  if (result.status !== 'created') throw new Error('not created');
  return result.cardId;
}

function open(editor: Editor) {
  const onClose = vi.fn();
  const onOpenCard = vi.fn();
  render(<AddEditSheet repo={repo} editor={editor} onClose={onClose} onOpenCard={onOpenCard} />);
  return { onClose, onOpenCard };
}

const field = (name: string) => screen.getByLabelText(name);

async function fillNewWord(word: string) {
  await userEvent.type(field('The word'), word);
  await userEvent.type(field('Similar words'), 'calm');
  await userEvent.type(field('In Persian'), 'آرام');
  await userEvent.type(field('In a sentence'), 'Stay calm.');
}

describe('Add word', () => {
  it('opens without putting the cursor in a field, so the keyboard stays closed', async () => {
    open({ mode: 'add' });
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    expect(sheet).toHaveFocus();
    expect(field('The word')).not.toHaveFocus();
  });

  it('shows an error under each empty field, saves nothing, and Save stays enabled', async () => {
    const { onClose } = open({ mode: 'add' });
    const save = await screen.findByRole('button', { name: 'Save word' });
    await userEvent.click(save);

    expect(await screen.findByText('Type the word.')).toBeInTheDocument();
    expect(field('The word')).toHaveAccessibleDescription('Type the word.');
    expect(field('Similar words')).toHaveAccessibleDescription('Add at least one similar word.');
    expect(field('In Persian')).toHaveAccessibleDescription('Add at least one Persian meaning.');
    expect(field('In a sentence')).toHaveAccessibleDescription('Add at least one sentence.');
    expect(save).toBeEnabled();
    expect(await repo.countCards()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears a field's error as soon as you type in it", async () => {
    open({ mode: 'add' });
    await userEvent.click(await screen.findByRole('button', { name: 'Save word' }));
    await userEvent.type(field('The word'), 'c');
    expect(screen.queryByText('Type the word.')).not.toBeInTheDocument();
    expect(screen.getByText('Add at least one similar word.')).toBeInTheDocument();
  });

  it('saves a new card in box 1, due tomorrow, and closes', async () => {
    const { onClose } = open({ mode: 'add' });
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const [card] = await db.cards.toArray();
    expect(card).toMatchObject({ word: 'calm', box: 1, dueDate: '2026-03-11' });
  });

  it('adds another field with "+ similar word", focuses it, and ignores it when left empty', async () => {
    const { onClose } = open({ mode: 'add' });
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    await userEvent.click(screen.getByRole('button', { name: '+ similar word' }));
    expect(field('Similar word 2')).toHaveFocus();
    expect(field('Similar word 2')).toHaveAttribute('placeholder', 'another one?');
    // No ✕ while adding (only in edit, decided 2026-10-29).
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const [card] = await db.cards.toArray();
    expect((await repo.getCard(card.id))?.synonyms.map((e) => e.text)).toEqual(['calm']);
  });

  it('writes Persian right to left', async () => {
    open({ mode: 'add' });
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: '+ meaning' }));
    expect(field('In Persian')).toHaveAttribute('lang', 'fa');
    expect(field('Persian meaning 2')).toHaveAttribute('lang', 'fa');
  });
});

describe('Adding a word you already have', () => {
  it('asks first; Cancel changes nothing and keeps what you typed', async () => {
    const id = await existing('Brave');
    await db.cards.update(id, { box: 4, dueDate: '2026-03-20' });
    const { onOpenCard } = open({ mode: 'add' });
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), '  brave ');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));

    const dialog = await screen.findByRole('dialog', { name: 'Oh! You already have “brave”' });
    expect(within(dialog).getByText(/move it back to the start/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: /already have/ })).not.toBeInTheDocument();
    expect(field('The word')).toHaveValue('  brave ');
    expect(await db.cards.get(id)).toMatchObject({ box: 4, dueDate: '2026-03-20' });
    expect(onOpenCard).not.toHaveBeenCalled();
    expect(await repo.countCards()).toBe(1);
  });

  it('"Open my card" sends it back to box 1, due tomorrow, and opens it', async () => {
    const id = await existing('brave');
    await db.cards.update(id, { box: 5, dueDate: '2026-04-01', masteredAt: now });
    const { onOpenCard, onClose } = open({ mode: 'add' });
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'BRAVE');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open my card' }));

    await vi.waitFor(() => expect(onOpenCard).toHaveBeenCalledWith(id));
    expect(onClose).toHaveBeenCalled();
    expect(await db.cards.get(id)).toMatchObject({
      box: 1,
      dueDate: '2026-03-11',
      masteredAt: null,
    });
    expect(await repo.countCards()).toBe(1);
  });
});

describe('Edit word', () => {
  it('starts filled in, says the schedule stays, and saves without moving the card', async () => {
    const id = await existing();
    await db.cards.update(id, { box: 3, dueDate: '2026-03-14' });
    const { onClose } = open({ mode: 'edit', cardId: id });

    expect(await screen.findByRole('dialog', { name: 'Edit word' })).toBeInTheDocument();
    expect(
      screen.getByText("Editing won't change when you see this word next."),
    ).toBeInTheDocument();
    expect(field('The word')).toHaveValue('brave');
    expect(field('Similar words')).toHaveValue('bold');
    expect(field('Similar word 2')).toHaveValue('daring');

    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    await userEvent.type(field('Sentence 2'), 'A brave choice.');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await repo.getCard(id);
    expect(saved?.card).toMatchObject({ box: 3, dueDate: '2026-03-14' });
    expect(saved?.sentences.map((e) => e.text)).toEqual(['She was brave.', 'A brave choice.']);
  });

  it('shows a ✕ next to each item while a list has more than one, and removes it on save', async () => {
    const id = await existing();
    const { onClose } = open({ mode: 'edit', cardId: id });
    await screen.findByRole('dialog', { name: 'Edit word' });

    // Two similar words → two ✕; one meaning and one sentence → none.
    expect(screen.getByRole('button', { name: 'Remove similar word 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove persian/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove sentence/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove similar word 1' }));
    // The last one can't be removed.
    expect(screen.queryByRole('button', { name: /Remove similar/ })).not.toBeInTheDocument();
    expect(field('Similar words')).toHaveValue('daring');

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repo.getCard(id))?.synonyms.map((e) => e.text)).toEqual(['daring']);
  });

  it('refuses a word you already have, with the error under the word', async () => {
    await existing('calm');
    const id = await existing('brave');
    const { onClose } = open({ mode: 'edit', cardId: id });
    await screen.findByRole('dialog', { name: 'Edit word' });
    await userEvent.clear(field('The word'));
    await userEvent.type(field('The word'), 'Calm');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('You already have this word.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect((await repo.getCard(id))?.card.word).toBe('brave');
  });
});
