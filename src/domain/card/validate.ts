/**
 * Checking the Add / Edit form (PRD "Card structure"). Pure: no storage, no UI.
 * Save is never disabled; each problem is reported per field so the UI can show it under that field.
 */

/** Same limits as the database (supabase/migrations: char_length checks). */
export const MAX_WORD_LENGTH = 200;
export const MAX_ENTRY_LENGTH = 1000;

export interface EntryInput {
  /** Present when editing an existing entry; absent for a new one. */
  readonly id?: string;
  readonly text: string;
}

export interface CardDraft {
  readonly word: string;
  readonly synonyms: readonly EntryInput[];
  readonly meanings: readonly EntryInput[];
  readonly sentences: readonly EntryInput[];
}

export const LIST_FIELDS = ['synonyms', 'meanings', 'sentences'] as const;
export type ListField = (typeof LIST_FIELDS)[number];
export type CardField = 'word' | ListField;
export type FieldError = 'required' | 'tooLong' | 'duplicate';
export type FieldErrors = Partial<Record<CardField, FieldError>>;

export type Validation = { ok: true; card: CardDraft } | { ok: false; errors: FieldErrors };

/** Trims the word and squeezes inner runs of spaces to one ("ice  cream " → "ice cream"). */
export function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, ' ');
}

/** The key used to spot duplicates: "Happy", " happy " and "HAPPY" are the same word. */
export function wordKey(word: string): string {
  return normalizeWord(word).toLowerCase();
}

/** Length in characters as the database counts them (so emoji or Persian count once each). */
function length(text: string): number {
  return [...text].length;
}

function cleanList(list: readonly EntryInput[]): EntryInput[] {
  return list.map((entry) => ({ ...entry, text: entry.text.trim() })).filter((e) => e.text !== '');
}

/**
 * Trims everything, drops empty list items, and checks each field.
 * Every field needs at least one item; nothing may be longer than the database allows.
 */
export function validateCard(draft: CardDraft): Validation {
  const errors: FieldErrors = {};
  const word = normalizeWord(draft.word);
  if (word === '') errors.word = 'required';
  else if (length(word) > MAX_WORD_LENGTH) errors.word = 'tooLong';

  const lists = {} as Record<ListField, EntryInput[]>;
  for (const field of LIST_FIELDS) {
    const list = cleanList(draft[field]);
    lists[field] = list;
    if (list.length === 0) errors[field] = 'required';
    else if (list.some((entry) => length(entry.text) > MAX_ENTRY_LENGTH)) errors[field] = 'tooLong';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, card: { word, ...lists } };
}
