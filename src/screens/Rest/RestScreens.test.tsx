// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AllDone, SessionComplete } from './RestScreens';

describe('Session complete', () => {
  it('shows the streak in the mascot speech bubble when there is one', () => {
    render(
      <SessionComplete
        wordCount={20}
        nextCount={0}
        onNext={() => {}}
        onDone={() => {}}
        streak={13}
      />,
    );
    expect(screen.getByText('13 days in a row!')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session complete!' })).toBeInTheDocument();
  });

  it('says "1 day in a row!" and hides the bubble without a streak or at 0', () => {
    const { rerender } = render(
      <SessionComplete
        wordCount={1}
        nextCount={0}
        onNext={() => {}}
        onDone={() => {}}
        streak={1}
      />,
    );
    expect(screen.getByText('1 day in a row!')).toBeInTheDocument();
    rerender(<SessionComplete wordCount={1} nextCount={0} onNext={() => {}} onDone={() => {}} />);
    expect(screen.queryByText(/in a row/)).not.toBeInTheDocument();
    rerender(
      <SessionComplete
        wordCount={1}
        nextCount={0}
        onNext={() => {}}
        onDone={() => {}}
        streak={0}
      />,
    );
    expect(screen.queryByText(/in a row/)).not.toBeInTheDocument();
    expect(screen.getByText('You went through 1 word. Nice work.')).toBeInTheDocument();
  });

  it('has only the buttons as buttons', async () => {
    const onNext = vi.fn();
    render(
      <SessionComplete wordCount={20} nextCount={5} onNext={onNext} onDone={() => {}} streak={3} />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Next 5 words',
      "I'm done for now",
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Next 5 words' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe('All done', () => {
  it('offers "Add a new word" when adding is possible', async () => {
    const onAddWord = vi.fn();
    render(<AllDone emptyBox={false} onAddWord={onAddWord} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a new word' }));
    expect(onAddWord).toHaveBeenCalledOnce();
  });
});
