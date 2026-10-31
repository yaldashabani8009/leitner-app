import { describe, expect, it } from 'vitest';
import { mergeTypedIntoCard } from './merge';

const existing = {
  word: 'charm',
  synonyms: [{ id: 's1', text: 'appeal' }],
  meanings: [{ id: 'm1', text: 'جذابیت' }],
  sentences: [{ id: 'e1', text: 'Her charm won everyone over.' }],
};

describe('mergeTypedIntoCard (canvas N5)', () => {
  it('keeps the saved items with their ids and adds what was typed, without repeats', () => {
    expect(
      mergeTypedIntoCard(existing, {
        word: ' Charm ',
        synonyms: [{ text: 'Appeal' }, { text: ' allure ' }, { text: '' }],
        meanings: [{ text: 'افسون' }],
        sentences: [{ text: '' }, { text: 'He keeps a lucky charm in his bag.' }],
      }),
    ).toEqual({
      word: 'Charm',
      synonyms: [{ id: 's1', text: 'appeal' }, { text: 'allure' }],
      meanings: [{ id: 'm1', text: 'جذابیت' }, { text: 'افسون' }],
      sentences: [
        { id: 'e1', text: 'Her charm won everyone over.' },
        { text: 'He keeps a lucky charm in his bag.' },
      ],
    });
  });

  it('with nothing typed it is just the saved card', () => {
    expect(
      mergeTypedIntoCard(existing, { word: '  ', synonyms: [], meanings: [], sentences: [] }),
    ).toEqual(existing);
  });
});
