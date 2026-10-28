// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('shows words learned and the streak, with clear names for screen readers', () => {
    render(<TopBar wordsLearned={128} streak={12} onAdd={() => {}} />);
    expect(screen.getByText('128 words learned')).toBeInTheDocument();
    expect(screen.getByText('12-day streak')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
  });

  it('says "1 word learned" for a single word', () => {
    render(<TopBar wordsLearned={1} streak={0} onAdd={() => {}} />);
    expect(screen.getByText('1 word learned')).toBeInTheDocument();
  });

  it('opens add word from the + button', async () => {
    const onAdd = vi.fn();
    render(<TopBar wordsLearned={0} streak={0} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add word' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('leaves out the parts it is not given', () => {
    render(<TopBar />);
    expect(screen.getByRole('banner')).toBeEmptyDOMElement();
  });
});
