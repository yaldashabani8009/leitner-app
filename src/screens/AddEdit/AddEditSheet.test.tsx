// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb } from '../../data/db';
import { createRepository, type Repository } from '../../data/repository';
import { deckById } from '../../domain/decks/decks';
import { AddEditSheet, type Editor } from './AddEditSheet';

const DAY_1 = '2026-03-10T08:00:00.000Z'; // the 10th in Tehran
const ADD: Editor = { mode: 'add', deck: deckById('vocab') };

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

async function existing(word = 'brave', deck: 'vocab' | 'spelling' = 'vocab') {
  const result = await repo.addCard(
    {
      word,
      synonyms: [{ text: 'bold' }, { text: 'daring' }],
      meanings: [{ text: 'شجاع' }],
      sentences: [{ text: 'She was brave.' }],
    },
    deck,
  );
  if (result.status !== 'created') throw new Error('not created');
  return result.cardId;
}

function open(editor: Editor) {
  const onClose = vi.fn();
  render(<AddEditSheet repo={repo} editor={editor} onClose={onClose} />);
  return { onClose };
}

const field = (name: string) => screen.getByLabelText(name);

/** The toast's live region is always there; wait for the message in it. */
const toastSays = (text: string) =>
  vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(text));

async function fillNewWord(word: string) {
  await userEvent.type(field('The word'), word);
  await userEvent.type(field('Similar words'), 'calm');
  await userEvent.type(field('In Persian'), 'آرام');
  await userEvent.type(field('Sentence 1'), 'Stay calm.');
}

describe('Add word', () => {
  it('opens without putting the cursor in a field, so the keyboard stays closed', async () => {
    open(ADD);
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    expect(sheet).toHaveFocus();
    expect(field('The word')).not.toHaveFocus();
  });

  it('shows an error under each empty field, saves nothing, and Save stays enabled', async () => {
    const { onClose } = open(ADD);
    const save = await screen.findByRole('button', { name: 'Save word' });
    await userEvent.click(save);

    expect(await screen.findByText('Type the word.')).toBeInTheDocument();
    expect(field('The word')).toHaveAccessibleDescription('Type the word.');
    expect(field('Similar words')).toHaveAccessibleDescription(
      'Separate them with a comma. Add at least one similar word.',
    );
    expect(field('In Persian')).toHaveAccessibleDescription(
      expect.stringContaining('Add at least one Persian meaning.'),
    );
    expect(field('Sentence 1')).toHaveAccessibleDescription('Add at least one sentence.');
    expect(save).toBeEnabled();
    expect(await repo.countCards()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears a field's error as soon as you type in it", async () => {
    open(ADD);
    await userEvent.click(await screen.findByRole('button', { name: 'Save word' }));
    await userEvent.type(field('The word'), 'c');
    expect(screen.queryByText('Type the word.')).not.toBeInTheDocument();
    expect(screen.getByText('Add at least one similar word.')).toBeInTheDocument();
  });

  it('shows the deck it adds to next to the title (canvas N4)', async () => {
    open({ mode: 'add', deck: deckById('spelling') });
    const sheet = await screen.findByRole('dialog', { name: 'New word' });
    expect(within(sheet).getByText('Spelling')).toBeInTheDocument();
  });

  it('saves a new card in box 1, due tomorrow, and stays open for the next word (canvas N4)', async () => {
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));

    // A toast for screen readers too; the fields clear and the cursor is back in the word field.
    await toastSays('calm saved');
    expect(field('The word')).toHaveValue('');
    expect(field('The word')).toHaveFocus();
    expect(field('The word')).toHaveAttribute('placeholder', 'Type the next word');
    expect(field('Similar words')).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
    // No Done button, no counter: only ✕ closes.
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

    const [card] = await db.cards.toArray();
    expect(card).toMatchObject({ word: 'calm', deck: 'vocab', box: 1, dueDate: '2026-03-11' });
  });

  it('adds three words in a row', async () => {
    open(ADD);
    await screen.findByRole('dialog');
    for (const word of ['calm', 'quiet', 'still']) {
      await fillNewWord(word);
      await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
      expect(await screen.findByText(`${word}`, { selector: 'b' })).toBeInTheDocument();
    }
    expect((await db.cards.toArray()).map((c) => c.word).sort()).toEqual([
      'calm',
      'quiet',
      'still',
    ]);
  });

  it('the toast goes away after about 2 seconds', async () => {
    open(ADD);
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await toastSays('calm saved');
    const shownAt = Date.now();
    await vi.waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement(), {
      timeout: 3000,
    });
    expect(Date.now() - shownAt).toBeGreaterThan(1500);
  });

  it('a tap outside does not close it; ✕ does', async () => {
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('splits similar words and meanings on "," and "،" (Yali, 2026-10-29)', async () => {
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'calm');
    await userEvent.type(field('Similar words'), 'peaceful, quiet,, serene ');
    await userEvent.type(field('In Persian'), 'آرام، ساکت,آسوده');
    await userEvent.type(field('Sentence 1'), 'Stay calm, please.');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));

    await toastSays('calm saved');
    expect(onClose).not.toHaveBeenCalled();
    const [card] = await db.cards.toArray();
    const saved = await repo.getCard(card.id);
    expect(saved?.synonyms.map((e) => e.text)).toEqual(['peaceful', 'quiet', 'serene']);
    expect(saved?.meanings.map((e) => e.text)).toEqual(['آرام', 'ساکت', 'آسوده']);
    // Sentences are never split: they contain commas.
    expect(saved?.sentences.map((e) => e.text)).toEqual(['Stay calm, please.']);
  });

  it('adds a sentence field right under the sentences, focuses it, and ignores it when left empty', async () => {
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    expect(screen.queryByRole('button', { name: '+ similar word' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    expect(field('Sentence 2')).toHaveFocus();
    // No ✕ while adding.
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await toastSays('calm saved');
    expect(onClose).not.toHaveBeenCalled();
    const [card] = await db.cards.toArray();
    expect((await repo.getCard(card.id))?.sentences.map((e) => e.text)).toEqual(['Stay calm.']);
  });

  it('writes Persian right to left', async () => {
    open(ADD);
    await screen.findByRole('dialog');
    expect(field('In Persian')).toHaveAttribute('lang', 'fa');
  });
});

describe('A word already in this deck (canvas N5)', () => {
  it('leaving the word field shows the note and fills the form, keeping what was typed', async () => {
    const id = await existing('Brave');
    await db.cards.update(id, { box: 4, dueDate: '2026-03-20' });
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('Similar words'), 'fearless');
    await userEvent.type(field('The word'), '  brave ');
    await userEvent.tab();

    expect(await screen.findByText('Already in your Vocab box')).toBeInTheDocument();
    expect(field('Similar words')).toHaveValue('bold, daring, fearless');
    expect(field('In Persian')).toHaveValue('شجاع');
    expect(field('Sentence 1')).toHaveValue('She was brave.');
    expect(screen.getByRole('button', { name: 'Save & start over' })).toBeInTheDocument();
    expect(screen.getByText('It goes back to the start of your box.')).toBeInTheDocument();
    // Nothing changed yet, and no popup.
    expect(await db.cards.get(id)).toMatchObject({ box: 4, dueDate: '2026-03-20' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Save straight away finds it too, without saving anything', async () => {
    await existing('brave');
    open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'BRAVE{Enter}');
    expect(await screen.findByText('Already in your Vocab box')).toBeInTheDocument();
    expect(await repo.countCards()).toBe(1);
  });

  it('"Save & start over" updates the card, sends it back to box 1 and counts it as added today', async () => {
    const id = await existing('brave');
    await db.cards.update(id, { box: 5, masteredAt: now, addedOn: '2026-03-01' });
    now = '2026-03-12T08:00:00.000Z';
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'brave');
    await userEvent.tab();
    await screen.findByText('Already in your Vocab box');
    await userEvent.type(field('Similar words'), ', fearless');
    await userEvent.click(screen.getByRole('button', { name: 'Save & start over' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'brave updated · back to the start',
    );
    expect(await db.cards.get(id)).toMatchObject({
      box: 1,
      dueDate: '2026-03-13',
      masteredAt: null,
      addedOn: '2026-03-12',
    });
    expect((await repo.getCard(id))?.synonyms.map((e) => e.text)).toEqual([
      'bold',
      'daring',
      'fearless',
    ]);
    // The sheet stays open, empty, for the next word.
    expect(field('The word')).toHaveValue('');
    expect(screen.queryByText('Already in your Vocab box')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(await repo.countCards()).toBe(1);
  });

  it('"Add another word" empties the form and changes nothing', async () => {
    const id = await existing('brave');
    await db.cards.update(id, { box: 3 });
    open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'brave');
    await userEvent.tab();
    await userEvent.click(await screen.findByRole('button', { name: 'Add another word' }));
    expect(field('The word')).toHaveValue('');
    expect(field('Similar words')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save word' })).toBeInTheDocument();
    expect(await db.cards.get(id)).toMatchObject({ box: 3 });
  });

  it('✕ changes nothing', async () => {
    const id = await existing('brave');
    await db.cards.update(id, { box: 3 });
    const { onClose } = open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'brave');
    await userEvent.tab();
    await screen.findByText('Already in your Vocab box');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(await db.cards.get(id)).toMatchObject({ box: 3 });
  });

  it('changing the word to a new one makes it a normal new word again', async () => {
    await existing('brave');
    open(ADD);
    await screen.findByRole('dialog');
    await userEvent.type(field('The word'), 'brave');
    await userEvent.tab();
    await screen.findByText('Already in your Vocab box');
    await userEvent.clear(field('The word'));
    await userEvent.type(field('The word'), 'bold');
    await userEvent.tab();
    await vi.waitFor(() =>
      expect(screen.queryByText('Already in your Vocab box')).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await toastSays('bold saved');
    expect(await repo.countCards()).toBe(2);
  });

  it('the same word in another deck is not a duplicate', async () => {
    await existing('brave', 'spelling');
    open(ADD);
    await screen.findByRole('dialog');
    await fillNewWord('brave');
    await userEvent.tab();
    expect(screen.queryByText(/Already in your/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await toastSays('brave saved');
    expect(await repo.countCards()).toBe(2);
  });
});

describe('Edit word', () => {
  it('starts filled in (lists joined by commas), says the schedule stays, and saves without moving the card', async () => {
    const id = await existing();
    await db.cards.update(id, { box: 3, dueDate: '2026-03-14' });
    const before = await repo.getCard(id);
    const { onClose } = open({ mode: 'edit', cardId: id });

    expect(await screen.findByRole('dialog', { name: 'Edit word' })).toBeInTheDocument();
    expect(
      screen.getByText("Editing won't change when you see this word next."),
    ).toBeInTheDocument();
    expect(field('The word')).toHaveValue('brave');
    expect(field('Similar words')).toHaveValue('bold, daring');
    expect(field('In Persian')).toHaveValue('شجاع');

    await userEvent.clear(field('Similar words'));
    await userEvent.type(field('Similar words'), 'daring, fearless');
    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    await userEvent.type(field('Sentence 2'), 'A brave choice.');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await repo.getCard(id);
    expect(saved?.card).toMatchObject({ box: 3, dueDate: '2026-03-14' });
    expect(saved?.synonyms.map((e) => e.text)).toEqual(['daring', 'fearless']);
    // "daring" kept its saved entry, so only the real change syncs.
    const daring = before?.synonyms.find((e) => e.text === 'daring');
    expect(saved?.synonyms[0].id).toBe(daring?.id);
    expect(saved?.sentences.map((e) => e.text)).toEqual(['She was brave.', 'A brave choice.']);
  });

  it('shows a ✕ next to each sentence while there is more than one, and removes it on save', async () => {
    const id = await existing();
    const { onClose } = open({ mode: 'edit', cardId: id });
    await screen.findByRole('dialog', { name: 'Edit word' });
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    await userEvent.type(field('Sentence 2'), 'Brave again.');
    await userEvent.click(screen.getByRole('button', { name: 'Remove sentence 1' }));
    // The last one can't be removed.
    expect(screen.queryByRole('button', { name: /Remove sentence/ })).not.toBeInTheDocument();
    expect(field('Sentence 1')).toHaveValue('Brave again.');

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repo.getCard(id))?.sentences.map((e) => e.text)).toEqual(['Brave again.']);
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

describe('sentence translations (v3 step 4, canvas P1)', () => {
  it('each sentence has an optional Persian field under it; both are saved', async () => {
    open(ADD);
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    const persian = field('Persian for sentence 1 (optional)');
    expect(persian).toHaveAttribute('lang', 'fa');
    expect(persian).toHaveAttribute('placeholder', 'Persian (optional)');
    await userEvent.type(persian, '  آرام بمان.  ');
    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    expect(field('Sentence 2')).toHaveFocus();
    expect(field('Persian for sentence 2 (optional)')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await toastSays('calm saved');
    const [card] = await db.cards.toArray();
    expect((await repo.getCard(card.id))?.sentences.map((e) => [e.text, e.translation])).toEqual([
      ['Stay calm.', 'آرام بمان.'],
    ]);
  });

  it('a Persian without its sentence: the error under the sentences, nothing saved', async () => {
    open(ADD);
    await screen.findByRole('dialog');
    await fillNewWord('calm');
    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    await userEvent.type(field('Persian for sentence 2 (optional)'), 'فقط فارسی');
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    expect(await screen.findByText('Add the sentence, or clear the Persian.')).toBeInTheDocument();
    expect(await repo.countCards()).toBe(0);
  });

  it('in Edit, ✕ removes a sentence and its Persian together; Persian can be changed', async () => {
    const id = await existing();
    const { onClose } = open({ mode: 'edit', cardId: id });
    await screen.findByRole('dialog', { name: 'Edit word' });
    await userEvent.type(field('Persian for sentence 1 (optional)'), 'او شجاع بود.');
    await userEvent.click(screen.getByRole('button', { name: '+ sentence' }));
    await userEvent.type(field('Sentence 2'), 'Brave again.');
    await userEvent.type(field('Persian for sentence 2 (optional)'), 'دوباره');
    await userEvent.click(screen.getByRole('button', { name: 'Remove sentence 2' }));
    expect(screen.queryByLabelText('Persian for sentence 2 (optional)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repo.getCard(id))?.sentences.map((e) => [e.text, e.translation])).toEqual([
      ['She was brave.', 'او شجاع بود.'],
    ]);
  });
});
