// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeckStatus } from '../../data/repository';
import { DECKS, type Deck } from '../../domain/decks/decks';
import { TodayScreen } from './TodayScreen';

const ALL: Deck[] = DECKS.map((deck) => ({ ...deck, enabled: true }));
const status = (deck: DeckStatus['deck'], over: Partial<DeckStatus> = {}): DeckStatus => ({
  deck,
  cardCount: 10,
  waiting: 0,
  pausedLeft: null,
  addedToday: 0,
  ...over,
});

function show(statuses: DeckStatus[], decks: Deck[] = ALL, name: string | null = 'Yali') {
  const handlers = { onMix: vi.fn(), onStudy: vi.fn(), onAdd: vi.fn() };
  render(<TodayScreen name={name} decks={decks} statuses={statuses} top={null} {...handlers} />);
  return handlers;
}

describe('TodayScreen (canvas N1)', () => {
  it('shows the four deck states with one status line each', () => {
    show([
      status('vocab', { waiting: 20 }),
      status('spelling', { waiting: 7, pausedLeft: 7 }),
      status('phrases', { cardCount: 0 }),
    ]);
    const decks = within(screen.getByRole('list', { name: 'Your decks' })).getAllByRole('button');
    expect(decks.map((d) => d.getAttribute('aria-label'))).toEqual([
      'Vocab, 20 waiting. Start',
      'Spelling, paused · 7 left. Continue',
      'Phrases, empty. Add words',
    ]);
    expect(screen.getByText('Paused · 7 left')).toBeInTheDocument();
    expect(screen.getByText('27 cards from all decks')).toBeInTheDocument();
  });

  it('says "Hi!" without a name, and 1 card in the singular', () => {
    show([status('vocab', { waiting: 1 })], [ALL[0]], null);
    expect(screen.getByRole('heading', { name: 'Hi!' })).toBeInTheDocument();
    expect(screen.getByText('1 card from all decks')).toBeInTheDocument();
  });

  it('routes each tap: study, continue, add, and the finished-deck sheet', async () => {
    const handlers = show([
      status('vocab', { waiting: 3 }),
      status('spelling', { pausedLeft: 2 }),
      status('phrases', { cardCount: 0 }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: /^Vocab/ }));
    expect(handlers.onStudy).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'vocab' }));
    await userEvent.click(screen.getByRole('button', { name: /^Spelling/ }));
    expect(handlers.onStudy).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'spelling' }));
    await userEvent.click(screen.getByRole('button', { name: /^Phrases/ }));
    expect(handlers.onAdd).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'phrases' }));
    await userEvent.click(screen.getByRole('button', { name: /Mix them all/ }));
    expect(handlers.onMix).toHaveBeenCalledOnce();
  });

  it('a finished deck opens "All done for today ✓" with Add (canvas N3)', async () => {
    const handlers = show([status('vocab'), status('spelling'), status('phrases')]);
    expect(screen.getAllByText('All done for today')).toHaveLength(4); // 3 decks + Mix them all
    await userEvent.click(screen.getByRole('button', { name: 'Phrases, all done for today' }));
    const sheet = await screen.findByRole('dialog', { name: 'Phrases' });
    expect(within(sheet).getByText('All done for today ✓')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add phrases' }));
    expect(handlers.onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'phrases' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dragging up spins the wheel to the next deck; a drag never opens a deck', () => {
    const handlers = show([status('vocab', { waiting: 1 }), status('spelling'), status('phrases')]);
    const labels = () =>
      within(screen.getByRole('list', { name: 'Your decks' }))
        .getAllByRole('button')
        .map((b) => b.textContent?.slice(0, 5));
    expect(labels()).toEqual(['Vocab', 'Spell', 'Phras']);

    const wheel = screen.getByRole('list', { name: 'Your decks' }).parentElement!;
    const deck = screen.getByRole('button', { name: /^Vocab/ });
    fireEvent.pointerDown(wheel, { clientY: 400 });
    fireEvent.pointerMove(wheel, { clientY: 330 });
    fireEvent.click(deck);
    fireEvent.pointerUp(wheel, { clientY: 330 });
    expect(labels()).toEqual(['Spell', 'Phras', 'Vocab']);
    expect(handlers.onStudy).not.toHaveBeenCalled();

    // Dragging down turns it back; a small move does nothing.
    fireEvent.pointerDown(wheel, { clientY: 300 });
    fireEvent.pointerMove(wheel, { clientY: 320 });
    fireEvent.pointerMove(wheel, { clientY: 380 });
    fireEvent.pointerUp(wheel, { clientY: 380 });
    expect(labels()).toEqual(['Vocab', 'Spell', 'Phras']);
  });

  it('with one deck the wheel does not spin', () => {
    show([status('vocab', { waiting: 1 })], [ALL[0]]);
    const wheel = screen.getByRole('list', { name: 'Your decks' }).parentElement!;
    fireEvent.pointerDown(wheel, { clientY: 400 });
    fireEvent.pointerMove(wheel, { clientY: 200 });
    fireEvent.pointerUp(wheel, { clientY: 200 });
    fireEvent.pointerMove(wheel, { clientY: 100 }); // no drag in progress
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('two decks hang from the top and middle places', () => {
    show([status('vocab'), status('spelling')], ALL.slice(0, 2));
    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toMatch(/top/);
    expect(items[1].className).toMatch(/middle/);
  });
});
