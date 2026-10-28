import { describe, expect, it } from 'vitest';
import {
  MAX_ENTRY_LENGTH,
  MAX_WORD_LENGTH,
  normalizeWord,
  validateCard,
  wordKey,
  type CardDraft,
} from './validate';

const items = (...texts: string[]) => texts.map((text) => ({ text }));

const good: CardDraft = {
  word: 'brave',
  synonyms: items('bold'),
  meanings: items('شجاع'),
  sentences: items('She was brave.'),
};

describe('normalizeWord and wordKey', () => {
  it('trims and squeezes spaces', () => {
    expect(normalizeWord('  ice   cream ')).toBe('ice cream');
  });

  it('treats capitals and spaces as the same word', () => {
    expect(wordKey('Happy')).toBe('happy');
    expect(wordKey(' happy ')).toBe('happy');
    expect(wordKey('HAPPY')).toBe('happy');
    expect(wordKey('Ice  Cream')).toBe(wordKey('ice cream'));
  });
});

describe('validateCard', () => {
  it('accepts a complete card', () => {
    expect(validateCard(good)).toEqual({ ok: true, card: good });
  });

  it('trims text and drops empty items, keeping ids and order', () => {
    const result = validateCard({
      word: '  brave ',
      synonyms: [{ id: 's1', text: ' bold ' }, { text: '   ' }, { text: 'daring' }],
      meanings: items(' شجاع '),
      sentences: items('She was brave.', ''),
    });
    expect(result).toEqual({
      ok: true,
      card: {
        word: 'brave',
        synonyms: [{ id: 's1', text: 'bold' }, { text: 'daring' }],
        meanings: items('شجاع'),
        sentences: items('She was brave.'),
      },
    });
  });

  it('reports every missing field at once, so each shows its own error', () => {
    expect(validateCard({ word: ' ', synonyms: [], meanings: items(''), sentences: [] })).toEqual({
      ok: false,
      errors: {
        word: 'required',
        synonyms: 'required',
        meanings: 'required',
        sentences: 'required',
      },
    });
  });

  it.each(['synonyms', 'meanings', 'sentences'] as const)(
    'reports only %s when only it is empty',
    (field) => {
      expect(validateCard({ ...good, [field]: items('  ') })).toEqual({
        ok: false,
        errors: { [field]: 'required' },
      });
    },
  );

  it('enforces the database length limits, counting characters like the database', () => {
    expect(validateCard({ ...good, word: 'a'.repeat(MAX_WORD_LENGTH) }).ok).toBe(true);
    expect(validateCard({ ...good, word: 'a'.repeat(MAX_WORD_LENGTH + 1) })).toEqual({
      ok: false,
      errors: { word: 'tooLong' },
    });
    // 1000 emoji are 2000 UTF-16 units but 1000 characters: still allowed.
    expect(validateCard({ ...good, sentences: items('😀'.repeat(MAX_ENTRY_LENGTH)) }).ok).toBe(
      true,
    );
    expect(
      validateCard({ ...good, meanings: items('ok', 'ب'.repeat(MAX_ENTRY_LENGTH + 1)) }),
    ).toEqual({ ok: false, errors: { meanings: 'tooLong' } });
  });
});
