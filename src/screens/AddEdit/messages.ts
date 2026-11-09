import type { DeckId } from '../../domain/leitner/config';
import {
  MAX_ENTRY_LENGTH,
  maxWordLength,
  type CardField,
  type FieldError,
  type ListField,
} from '../../domain/card/validate';

/** Words for each list, in the order of the form (canvas 09 / 10). */
export const LISTS: Record<
  ListField,
  {
    label: string;
    one: string;
    add: string;
    required: string;
    lang?: 'fa';
    placeholder?: string;
    /** Shown under comma fields. */
    hint?: string;
  }
> = {
  synonyms: {
    label: 'Similar words',
    one: 'Similar word',
    add: 'similar word',
    required: 'Add at least one similar word.',
    placeholder: 'careful, precise',
    hint: 'Separate them with a comma.',
  },
  meanings: {
    label: 'In Persian',
    one: 'Persian meaning',
    add: 'meaning',
    required: 'Add at least one Persian meaning.',
    lang: 'fa',
    placeholder: 'معنی فارسی، …',
    hint: 'Separate them with a comma (، or ,).',
  },
  sentences: {
    label: 'In a sentence',
    one: 'Sentence',
    add: 'sentence',
    required: 'Add at least one sentence.',
  },
};

/** The message shown under a field (PRD: errors appear under the field, Save is never disabled). */
export function errorText(field: CardField, error: FieldError, deck: DeckId = 'vocab'): string {
  const thing = deck === 'phrases' ? 'phrase' : 'word';
  if (error === 'duplicate') return `You already have this ${thing}.`;
  if (error === 'orphanTranslation') return 'Add the sentence, or clear the Persian.';
  if (error === 'tooLong') {
    const max = field === 'word' ? maxWordLength(deck) : MAX_ENTRY_LENGTH;
    return `That's too long. Keep it under ${max} characters.`;
  }
  return field === 'word' ? `Type the ${thing}.` : LISTS[field].required;
}
