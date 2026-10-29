// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { PlusIcon } from './icons';

describe('Button', () => {
  it('is a primary, non-submitting button by default', () => {
    render(<Button>Knew it!</Button>);
    const button = screen.getByRole('button', { name: 'Knew it!' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toMatch(/primary/);
  });

  it.each(['aqua', 'secondary', 'text'] as const)('uses the %s style', (variant) => {
    render(<Button variant={variant}>Not yet</Button>);
    expect(screen.getByRole('button', { name: 'Not yet' }).className).toMatch(variant);
  });

  it('keeps extra class names and calls onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button className="extra" onClick={onClick}>
        Save word
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save word' });
    expect(button).toHaveClass('extra');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('IconButton', () => {
  it('is named by its label, since there is no visible text', () => {
    render(<IconButton label="Add word" icon={<PlusIcon />} />);
    const button = screen.getByRole('button', { name: 'Add word' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toMatch(/primary/);
    // The icon itself is hidden from screen readers.
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(['cream', 'white'] as const)('has a %s variant', (variant) => {
    render(<IconButton label="Close" icon={<PlusIcon />} variant={variant} />);
    expect(screen.getByRole('button', { name: 'Close' }).className).toMatch(variant);
  });

  it('has a cream variant and calls onClick', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Edit word" icon={<PlusIcon />} variant="cream" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Edit word' });
    expect(button.className).toMatch(/cream/);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
