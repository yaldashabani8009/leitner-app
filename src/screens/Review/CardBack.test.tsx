// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CardWithEntries } from '../../data/repository';
import { CardBack } from './CardBack';

const entry = (
  id: string,
  kind: 'synonym' | 'meaning' | 'sentence',
  text: string,
  translation: string | null = null,
) => ({
  id,
  cardId: 'c',
  kind,
  text,
  translation,
  position: 0,
  updatedAt: 't',
  deletedAt: null,
});

const card = {
  card: { id: 'c', word: 'meticulous' },
  synonyms: [entry('s', 'synonym', 'careful')],
  meanings: [entry('m', 'meaning', 'دقیق')],
  sentences: [
    entry('e1', 'sentence', 'She keeps meticulous notes.', 'او یادداشت‌های دقیقی برمی‌دارد.'),
    entry('e2', 'sentence', 'The repair needed meticulous work.'),
  ],
} as unknown as CardWithEntries;

describe('CardBack: sentence translations (canvas P2)', () => {
  it('tap shows the Persian under the sentence, tap again hides it; Enter works too', async () => {
    render(<CardBack card={card} />);
    const sentence = screen.getByRole('button', {
      name: /Persian translation hidden, tap to show/,
    });
    expect(sentence).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(sentence);
    expect(sentence).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('او یادداشت‌های دقیقی برمی‌دارد.')).toHaveAttribute('dir', 'rtl');
    await userEvent.click(sentence);
    expect(sentence).toHaveAttribute('aria-expanded', 'false');
    sentence.focus();
    await userEvent.keyboard('{Enter}');
    expect(sentence).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('CardBack: Persian meanings (bug 6, 2026-11-09)', () => {
  it('each meaning is its own chip, right to left', () => {
    const two = {
      ...card,
      meanings: [entry('m1', 'meaning', 'بررسی کردن'), entry('m2', 'meaning', 'مطالعه کردن')],
    } as unknown as CardWithEntries;
    render(<CardBack card={two} />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('lang', 'fa');
    expect(list).toHaveAttribute('dir', 'rtl');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'بررسی کردن',
      'مطالعه کردن',
    ]);
  });
});

describe('CardBack: phrases (canvas P9, P10)', () => {
  const phrase = (meanings: unknown[], sentences: unknown[]) =>
    ({
      card: { id: 'p', word: 'break the ice', deck: 'phrases' },
      synonyms: [],
      meanings,
      sentences,
    }) as unknown as CardWithEntries;

  it('only what exists: a sentence and no Persian shows no empty Persian slot', () => {
    render(
      <CardBack card={phrase([], [entry('e', 'sentence', 'A game helped break the ice.')])} />,
    );
    expect(screen.queryByText('in Persian')).not.toBeInTheDocument();
    expect(screen.queryByText('similar words')).not.toBeInTheDocument();
    expect(screen.getByText('in a sentence')).toBeInTheDocument();
    expect(screen.getByText('break the ice', { selector: 'mark' })).toBeInTheDocument();
  });

  it('nothing at all: the phrase again and "No meaning yet", pencil still there', () => {
    render(<CardBack card={phrase([], [])} onEdit={() => {}} />);
    expect(screen.getByText('No meaning yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit phrase' })).toBeInTheDocument();
  });
});
