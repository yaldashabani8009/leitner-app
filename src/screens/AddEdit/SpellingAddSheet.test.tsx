// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb } from '../../data/db';
import { createRepository, type Repository } from '../../data/repository';
import { deckById } from '../../domain/decks/decks';
import { AddEditSheet } from './AddEditSheet';

let db: LeitnerDb;
let repo: Repository;

beforeEach(async () => {
  db = new LeitnerDb(`spell-${crypto.randomUUID()}`);
  repo = createRepository(db, {
    now: () => '2026-03-10T08:00:00.000Z',
    newId: () => crypto.randomUUID(),
  });
  await repo.saveProfile({ userId: 'u1', displayName: 'Yali', timeZone: 'UTC', updatedAt: 'x' });
});

afterEach(async () => {
  await db.delete();
});

function open() {
  const onClose = vi.fn();
  render(
    <AddEditSheet
      repo={repo}
      editor={{ mode: 'add', deck: deckById('spelling') }}
      onClose={onClose}
    />,
  );
  return { onClose };
}

const box = () => screen.getByLabelText('Words');
/** Typing into the box (fireEvent: new lines and commas in one go, like a paste). */
const paste = (text: string) => fireEvent.change(box(), { target: { value: text } });
const chipList = () => screen.getByRole('list', { name: 'Words to save' });
const toastSays = (text: string) =>
  vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(text));

describe('Spelling add sheet (canvas P3, P4)', () => {
  it('one big box with autocorrect, capitals and spellcheck off; title and deck chip', async () => {
    open();
    const sheet = await screen.findByRole('dialog', { name: 'New words' });
    expect(within(sheet).getByText('Spelling')).toBeInTheDocument();
    expect(box()).toHaveAttribute('autocapitalize', 'off');
    expect(box()).toHaveAttribute('autocorrect', 'off');
    expect(box()).toHaveAttribute('spellcheck', 'false');
    expect(box()).toHaveAccessibleDescription(
      'One per line, or separated by commas. Paste from Live Text works too.',
    );
  });

  it('Check turns the list into chips: plain, greyed "already there", dashed "looks odd"', async () => {
    await repo.addSpellingWords(['necessary']);
    open();
    await screen.findByRole('dialog');
    paste('receive, believe\nnecessary\n1. separate\n• ice cream, a lot\nWednesday\npg 12\nدیکته');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('Tap a word to fix it, or ✕ to drop it.')).toBeInTheDocument();
    const items = within(chipList()).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'receive',
      'believe',
      'necessary · already there',
      'separate',
      'ice cream',
      'a lot',
      'Wednesday',
      'pg 12',
      'دیکته',
    ]);
    // Greyed chips have no ✕; odd ones say so.
    expect(screen.queryByRole('button', { name: 'Remove necessary' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'pg 12, looks odd, tap to fix' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Already in your Spelling box: skipped')).toBeInTheDocument();
    expect(
      screen.getByText('Looks odd (numbers, Persian, 4+ words): check it'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 8 words' })).toBeInTheDocument();
  });

  it('tap a chip to fix it (checked again), ✕ to drop it; Back to the text keeps the list', async () => {
    open();
    await screen.findByRole('dialog');
    paste('recieve\npg 12\nrhythm');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    await userEvent.click(screen.getByRole('button', { name: 'recieve, tap to fix' }));
    const edit = screen.getByRole('textbox', { name: 'Fix recieve' });
    await userEvent.clear(edit);
    await userEvent.type(edit, 'receive{Enter}');
    expect(screen.getByRole('button', { name: 'receive, tap to fix' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'pg 12, looks odd, tap to fix' }));
    const odd = screen.getByRole('textbox', { name: 'Fix pg 12' });
    await userEvent.clear(odd);
    await userEvent.type(odd, 'page');
    fireEvent.blur(odd);
    expect(screen.getByRole('button', { name: 'page, tap to fix' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove rhythm' }));
    expect(screen.getByRole('button', { name: 'Save 2 words' })).toBeInTheDocument();

    // Emptying a chip drops it.
    await userEvent.click(screen.getByRole('button', { name: 'page, tap to fix' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Fix page' }));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Save 1 word' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to the text' }));
    expect(box()).toHaveValue('receive');
  });

  it('paste 10 words, save them all: toast "10 saved", the box clears and keeps the cursor', async () => {
    const { onClose } = open();
    await screen.findByRole('dialog');
    const ten = [
      'receive',
      'believe',
      'separate',
      'rhythm',
      'necessary',
      'embarrass',
      'occurrence',
      'definitely',
      'accommodate',
      'privilege',
    ];
    paste(ten.map((w, i) => `${i + 1}. ${w}`).join('\n'));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 10 words' }));

    await toastSays('10 saved');
    expect(box()).toHaveValue('');
    await vi.waitFor(() => expect(box()).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();
    const cards = await db.cards.where('deck').equals('spelling').toArray();
    expect(cards.map((c) => c.word).sort()).toEqual([...ten].sort());
  });

  it('everything already there: no Save, a line saying so', async () => {
    await repo.addSpellingWords(['receive']);
    open();
    await screen.findByRole('dialog');
    paste('Receive');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('All of these are already in your Spelling box.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the text' })).toBeInTheDocument();
  });

  it('Check with nothing typed does nothing', async () => {
    open();
    await screen.findByRole('dialog');
    paste(' ,\n ');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.queryByRole('list', { name: 'Words to save' })).not.toBeInTheDocument();
  });

  it('a spelling card edits with just "The word"', async () => {
    await repo.addSpellingWords(['recieve']);
    const [card] = await db.cards.toArray();
    const onClose = vi.fn();
    render(
      <AddEditSheet repo={repo} editor={{ mode: 'edit', cardId: card.id }} onClose={onClose} />,
    );
    const sheet = await screen.findByRole('dialog', { name: 'Edit word' });
    expect(within(sheet).getByText('Spelling')).toBeInTheDocument();
    expect(within(sheet).queryByLabelText('Similar words')).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: '+ sentence' })).not.toBeInTheDocument();
    const word = within(sheet).getByLabelText('The word');
    await userEvent.clear(word);
    await userEvent.type(word, 'receive');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await db.cards.get(card.id))?.word).toBe('receive');
  });
});
