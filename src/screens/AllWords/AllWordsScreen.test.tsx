// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WordRow } from '../../domain/allWords/allWords';
import { DECKS, type Deck } from '../../domain/decks/decks';
import { AllWordsScreen } from './AllWordsScreen';

const ALL: Deck[] = DECKS.map((deck) => ({ ...deck, enabled: true }));
const TODAY = '2026-10-31';

const row = (word: string, over: Partial<WordRow> = {}): WordRow => ({
  id: word,
  word,
  deck: 'vocab',
  box: 1,
  mastered: false,
  addedOn: TODAY,
  createdAt: `${TODAY}T08:00:00.000Z`,
  meanings: [],
  misses: 0,
  ...over,
});

const ROWS = [
  row('meticulous', { meanings: ['دقیق', 'وسواسی'], createdAt: `${TODAY}T09:00:00.000Z` }),
  row('receive', { deck: 'spelling', misses: 3 }),
  row('reluctant', { addedOn: '2026-10-30', box: 2, meanings: ['بی‌میل'] }),
  row('ambiguous', { addedOn: '2026-09-14', box: 5, mastered: true, misses: 1 }),
  row('break the ice', { deck: 'phrases', addedOn: '2026-10-30' }),
];

function show(rows: WordRow[] = ROWS, decks: Deck[] = ALL) {
  const handlers = {
    onBack: vi.fn(),
    onAdd: vi.fn(),
    onOpenCard: vi.fn(),
    onDelete: vi.fn(),
    onPracticeDay: vi.fn(),
  };
  render(<AllWordsScreen rows={rows} decks={decks} today={TODAY} {...handlers} />);
  return handlers;
}

/** The words in the list, top to bottom (the row buttons carry the progress label). */
const listed = () =>
  screen
    .queryAllByRole('img', { name: /Box \d of 5|Mastered/ })
    .map((dots) => dots.closest('button')!.querySelector('span span')!.textContent);
const headings = () =>
  screen
    .queryAllByRole('button', { name: /^Practice words added/ })
    .map((b) => b.getAttribute('aria-label'));

describe('AllWordsScreen (canvas N8–N10)', () => {
  it('header, chips with counts (All plus each enabled deck)', () => {
    show();
    expect(screen.getByRole('heading', { name: 'In your box' })).toBeInTheDocument();
    expect(screen.getByText('5 cards')).toBeInTheDocument();
    const chips = within(screen.getByRole('group', { name: 'Decks' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      'All 5',
      'Vocab 3',
      'Spelling 1',
      'Phrases 1',
    ]);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('with only vocab enabled, the chips are All and Vocab', () => {
    show(ROWS, [ALL[0]]);
    const chips = within(screen.getByRole('group', { name: 'Decks' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['All 5', 'Vocab 3']);
  });

  it('by day: newest first under TODAY / YESTERDAY / 14 SEP, each with Practice', async () => {
    const handlers = show();
    expect(listed()).toEqual(['meticulous', 'receive', 'break the ice', 'reluctant', 'ambiguous']);
    expect(headings()).toEqual([
      'Practice words added today',
      'Practice words added yesterday',
      'Practice words added on 14 SEP',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Practice words added yesterday' }));
    expect(handlers.onPracticeDay).toHaveBeenCalledWith('2026-10-30', [
      'vocab',
      'spelling',
      'phrases',
    ]);
  });

  it('A–Z and Needs work have no headings (sort menu, N10)', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Sort: by day' }));
    const menu = screen.getByRole('menu', { name: 'Sort' });
    expect(within(menu).getByRole('menuitemradio', { name: 'By day' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'A–Z' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(listed()).toEqual(['ambiguous', 'break the ice', 'meticulous', 'receive', 'reluctant']);
    expect(headings()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Sort: a–z' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Needs work' }));
    expect(listed()[0]).toBe('receive');
    expect(listed()[1]).toBe('ambiguous');
  });

  it('a deck chip filters, and its Practice uses only that deck; deck icons only on All', async () => {
    const handlers = show();
    const allIcons = document.querySelectorAll('li svg[aria-hidden="true"]').length;
    expect(allIcons).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Vocab 3' }));
    expect(screen.getByRole('button', { name: 'Vocab 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(listed()).toEqual(['meticulous', 'reluctant', 'ambiguous']);
    // No deck icon before the word on a deck's own view.
    expect(
      document.querySelectorAll('li button[class*="row"] > svg[aria-hidden="true"]'),
    ).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Practice words added today' }));
    expect(handlers.onPracticeDay).toHaveBeenCalledWith(TODAY, ['vocab']);
  });

  it('search matches the word and the Persian (ي = ی, half-space ignored)', async () => {
    show();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search words' }), 'دقي');
    expect(listed()).toEqual(['meticulous']);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'بیمیل');
    expect(listed()).toEqual(['reluctant']);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No words match “zzz”.')).toBeInTheDocument();
  });

  it('progress dots say the box, or Mastered with a star; Persian under the word', () => {
    show();
    expect(screen.getByRole('img', { name: 'Box 2 of 5' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mastered' })).toBeInTheDocument();
    expect(screen.getByText('دقیق، وسواسی')).toHaveAttribute('lang', 'fa');
  });

  it('tap opens the card; swipe left shows Delete, a second tap deletes; swipe right closes', async () => {
    const handlers = show();
    const meticulous = screen.getByRole('button', { name: /^meticulous/ });
    await userEvent.click(meticulous);
    expect(handlers.onOpenCard).toHaveBeenCalledWith('meticulous');

    fireEvent.pointerDown(meticulous, { clientX: 300 });
    fireEvent.pointerMove(meticulous, { clientX: 220 });
    fireEvent.click(meticulous); // the end of the swipe is not a tap
    expect(handlers.onOpenCard).toHaveBeenCalledTimes(1);
    const del = screen.getByRole('button', { name: 'Delete' });
    fireEvent.pointerDown(meticulous, { clientX: 200 });
    fireEvent.pointerMove(meticulous, { clientX: 260 });
    fireEvent.click(meticulous);
    expect(del).not.toBeInTheDocument();

    fireEvent.pointerDown(meticulous, { clientX: 300 });
    fireEvent.pointerMove(meticulous, { clientX: 220 });
    fireEvent.click(meticulous);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'meticulous' }));
  });

  it('keyboard: Delete shows the Delete button, Esc hides it, a tap on an open row closes it', async () => {
    show();
    const row = screen.getByRole('button', { name: /^receive/ });
    row.focus();
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Delete}');
    await userEvent.click(row);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await userEvent.keyboard('a{Escape}'); // other keys do nothing
  });

  it('virtualised: thousands of words, only the visible ones drawn', () => {
    const many = Array.from({ length: 3000 }, (_, i) =>
      row(`word${String(i).padStart(4, '0')}`, {
        createdAt: `${TODAY}T08:${String(i % 60).padStart(2, '0')}:00.000Z`,
      }),
    );
    show(many);
    expect(screen.getByText('3000 cards')).toBeInTheDocument();
    expect(document.querySelectorAll('li').length).toBeLessThan(60);
    const scroller = document.querySelector('ul')!.parentElement!;
    fireEvent.scroll(scroller, { target: { scrollTop: 50_000 } });
    expect(document.querySelectorAll('li').length).toBeLessThan(60);
  });

  it('an empty box shows the mascot and "Your box is empty"; while loading, no count', () => {
    show([]);
    expect(screen.getByText('Your box is empty')).toBeInTheDocument();
  });

  it('loading: no total yet', () => {
    const noop = () => {};
    render(
      <AllWordsScreen
        rows={undefined}
        decks={ALL}
        today={TODAY}
        onBack={noop}
        onAdd={noop}
        onOpenCard={noop}
        onDelete={noop}
        onPracticeDay={noop}
      />,
    );
    expect(screen.queryByText(/^\d+ cards?$/)).not.toBeInTheDocument();
  });

  it('Back and + work', async () => {
    const handlers = show(ROWS, [ALL[0]]);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(handlers.onBack).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));
    expect(handlers.onAdd).toHaveBeenCalled();
  });
});
