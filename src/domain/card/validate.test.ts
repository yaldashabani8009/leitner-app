import { describe, expect, it } from 'vitest';
import {
  cleanTranslation,
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

describe('sentence translations (v3 step 4)', () => {
  it('are trimmed, and blank ones become none', () => {
    expect(cleanTranslation('  او شجاع بود.  ')).toBe('او شجاع بود.');
    expect(cleanTranslation('   ')).toBeNull();
    expect(cleanTranslation('')).toBeNull();
    expect(cleanTranslation(null)).toBeNull();
    expect(cleanTranslation(undefined)).toBeNull();
  });

  it("validateCard keeps a sentence's translation, cleaned", () => {
    const result = validateCard({
      word: 'brave',
      synonyms: [{ text: 'bold' }],
      meanings: [{ text: 'شجاع' }],
      sentences: [
        { text: ' She was brave. ', translation: ' او شجاع بود. ' },
        { text: 'No Persian.', translation: '  ' },
        { text: 'Untouched.' },
      ],
    });
    expect(result.ok && result.card.sentences).toEqual([
      { text: 'She was brave.', translation: 'او شجاع بود.' },
      { text: 'No Persian.', translation: null },
      { text: 'Untouched.' },
    ]);
  });
});

describe('a Persian without its sentence (v3 step 4)', () => {
  const base = { word: 'brave', synonyms: [{ text: 'bold' }], meanings: [{ text: 'شجاع' }] };

  it('is an error under the sentences', () => {
    expect(
      validateCard({
        ...base,
        sentences: [{ text: 'She was brave.' }, { text: '  ', translation: 'او شجاع بود.' }],
      }),
    ).toEqual({ ok: false, errors: { sentences: 'orphanTranslation' } });
  });

  it('an empty pair is just dropped', () => {
    const result = validateCard({
      ...base,
      sentences: [{ text: 'She was brave.' }, { text: '', translation: '  ' }],
    });
    expect(result.ok && result.card.sentences).toEqual([{ text: 'She was brave.' }]);
  });

  it('a too-long Persian is too long', () => {
    expect(
      validateCard({ ...base, sentences: [{ text: 'Hi.', translation: 'ی'.repeat(1001) }] }),
    ).toEqual({ ok: false, errors: { sentences: 'tooLong' } });
  });
});

describe('required lists per deck (v3)', () => {
  const bare = { word: 'receive', synonyms: [], meanings: [], sentences: [] };
  it('vocab needs all three lists; spelling and phrases need none', () => {
    expect(validateCard(bare).ok).toBe(false);
    expect(validateCard(bare, 'vocab').ok).toBe(false);
    expect(validateCard(bare, 'spelling')).toEqual({ ok: true, card: bare });
    expect(validateCard(bare, 'phrases')).toEqual({ ok: true, card: bare });
    expect(validateCard({ ...bare, word: ' ' }, 'spelling')).toEqual({
      ok: false,
      errors: { word: 'required' },
    });
  });
});
