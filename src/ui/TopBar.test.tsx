// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('shows every card in the box and the streak, with clear names for screen readers', () => {
    render(<TopBar cardCount={312} streak={12} onAdd={() => {}} />);
    expect(screen.getByText('312 cards in your box')).toBeInTheDocument();
    expect(screen.getByText('12-day streak')).toBeInTheDocument();
    expect(screen.getByText('312')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
  });

  it('says "no streak yet" instead of "0-day streak" (audit 2026-10-29)', () => {
    render(<TopBar cardCount={0} streak={0} onAdd={() => {}} />);
    expect(screen.getByText('no streak yet')).toBeInTheDocument();
    expect(screen.queryByText('0-day streak')).not.toBeInTheDocument();
  });

  it('says "1 card in your box" for a single card', () => {
    render(<TopBar cardCount={1} streak={0} onAdd={() => {}} />);
    expect(screen.getByText('1 card in your box')).toBeInTheDocument();
  });

  it('the box badge is a button that opens all words', async () => {
    const onOpenBox = vi.fn();
    render(<TopBar cardCount={5} onOpenBox={onOpenBox} />);
    await userEvent.click(screen.getByRole('button', { name: '5 cards in your box' }));
    expect(onOpenBox).toHaveBeenCalledOnce();
  });

  it('without a tap action the badge is plain text', () => {
    render(<TopBar cardCount={5} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens add word from the + button', async () => {
    const onAdd = vi.fn();
    render(<TopBar cardCount={0} streak={0} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('leaves out the parts it is not given', () => {
    render(<TopBar />);
    expect(screen.getByRole('banner')).toBeEmptyDOMElement();
  });
});
