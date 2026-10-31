// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DECKS, deckById, type Deck } from '../domain/decks/decks';
import { AddButton } from './AddButton';

const ALL: Deck[] = DECKS.map((deck) => ({ ...deck, enabled: true }));

describe('AddButton (canvas N2)', () => {
  it('with one enabled deck, + opens that deck straight away', async () => {
    const onPick = vi.fn();
    render(<AddButton decks={[deckById('vocab')]} onPick={onPick} />);
    const plus = screen.getByRole('button', { name: 'Add word' });
    expect(plus).not.toHaveAttribute('aria-expanded');
    await userEvent.click(plus);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'vocab' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('with three decks, + rolls out one button per deck and becomes ✕', async () => {
    const onPick = vi.fn();
    render(<AddButton decks={ALL} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));

    const menu = screen.getByRole('group', { name: 'Add to which deck?' });
    expect(
      within(menu)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Vocab', 'Spelling', 'Phrases']);
    expect(within(menu).getByRole('button', { name: 'Vocab' })).toHaveFocus();
    const close = screen.getByRole('button', { name: 'Close add menu' });
    expect(close).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(within(menu).getByRole('button', { name: 'Spelling' }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'spelling' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('✕, a tap outside or Esc rolls it back without picking', async () => {
    const onPick = vi.fn();
    const { container } = render(<AddButton decks={ALL} onPick={onPick} />);
    const toggle = () => screen.getByRole('button', { name: /Add word|Close add menu/ });

    await userEvent.click(toggle());
    await userEvent.click(screen.getByRole('button', { name: 'Close add menu' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(toggle()).toHaveFocus();

    await userEvent.click(toggle());
    await userEvent.click(container.querySelector('[aria-hidden="true"]') as HTMLElement);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    await userEvent.click(toggle());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('AddButton opened by the N key', () => {
  it('a new signal rolls it out (several decks) or opens the deck (one deck)', () => {
    const onPick = vi.fn();
    const { rerender } = render(<AddButton decks={ALL} onPick={onPick} openSignal={0} />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    rerender(<AddButton decks={ALL} onPick={onPick} openSignal={1} />);
    expect(screen.getByRole('group', { name: 'Add to which deck?' })).toBeInTheDocument();
    rerender(<AddButton decks={[deckById('vocab')]} onPick={onPick} openSignal={2} />);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'vocab' }));
  });
});
