// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardWithEntries } from '../../data/repository';
import { ReviewScreen } from './ReviewScreen';

const card = {
  card: { id: 'c', word: 'brave', deck: 'vocab' },
  synonyms: [],
  meanings: [],
  sentences: [],
} as unknown as CardWithEntries;

afterEach(() => {
  cleanup();
  for (const key of ['scrollHeight', 'clientHeight'])
    Reflect.deleteProperty(HTMLElement.prototype, key);
});

function backHeights(scroll: number, client: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => scroll,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => client,
  });
}

const swipeTarget = () => screen.getByLabelText('Answer for brave').parentElement!;

describe('ReviewScreen swipe area (2026-11-15)', () => {
  it('a card back that fits takes the whole gesture, so a slightly diagonal swipe still counts', async () => {
    backHeights(300, 400);
    render(<ReviewScreen card={card} progress={0} reaction={null} onAnswer={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /tap to flip/ }));
    expect(swipeTarget().className).not.toMatch(/swipeableScrolls/);
  });

  it('a long card back still scrolls up and down', async () => {
    backHeights(800, 400);
    render(<ReviewScreen card={card} progress={0} reaction={null} onAnswer={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /tap to flip/ }));
    expect(swipeTarget().className).toMatch(/swipeableScrolls/);
  });
});
