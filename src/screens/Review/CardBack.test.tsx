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
