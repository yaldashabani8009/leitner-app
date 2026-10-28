// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookIcon } from './icons';
import { AddPill, Pill } from './Pill';

describe('Pill', () => {
  it('shows a tag as plain text', () => {
    const { container } = render(<Pill variant="tag">careful</Pill>);
    expect(screen.getByText('careful')).toBeInTheDocument();
    expect(container.firstElementChild!.className).toMatch(/tag/);
  });

  it('is not a button', () => {
    render(<Pill variant="label">do you know it?</Pill>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('gives label pills a cream fill by default and aqua on request', () => {
    const { container, rerender } = render(<Pill variant="label">do you know it?</Pill>);
    expect(container.firstElementChild!.className).toMatch(/cream/);
    rerender(
      <Pill variant="label" tone="aqua">
        one more look
      </Pill>,
    );
    expect(container.firstElementChild!.className).toMatch(/aqua/);
  });

  it('only uses the tone for label pills', () => {
    const { container } = render(
      <Pill variant="tag" tone="aqua">
        careful
      </Pill>,
    );
    expect(container.firstElementChild!.className).not.toMatch(/\baqua\b/);
  });

  it('reads the full text for screen readers and hides the bare number', () => {
    render(
      <Pill variant="stat" icon={<BookIcon />} srLabel="128 words learned">
        128
      </Pill>,
    );
    expect(screen.getByText('128 words learned')).toBeInTheDocument();
    expect(screen.getByText('128')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('AddPill', () => {
  it('is a real button with a + in front', async () => {
    const onClick = vi.fn();
    render(<AddPill onClick={onClick}>similar word</AddPill>);
    const button = screen.getByRole('button', { name: '+ similar word' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
