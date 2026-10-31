/**
 * "Already in your box" (v3 brief 1.8, canvas N5): the add form fills with the existing card
 * and keeps what you had typed. Pure.
 */

import type { CardDraft, EntryInput } from './validate';

const key = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

function mergeList(saved: readonly EntryInput[], typed: readonly EntryInput[]): EntryInput[] {
  const seen = new Set(saved.map((entry) => key(entry.text)));
  const merged = [...saved];
  for (const entry of typed) {
    const k = key(entry.text);
    if (k === '' || seen.has(k)) continue;
    seen.add(k);
    merged.push({ text: entry.text.trim() });
  }
  return merged;
}

/**
 * The existing card's lists (with their ids, so saving keeps them) followed by anything new
 * that was typed; repeats and empty items are left out. The word stays as typed.
 */
export function mergeTypedIntoCard(existing: CardDraft, typed: CardDraft): CardDraft {
  return {
    word: typed.word.trim() || existing.word,
    synonyms: mergeList(existing.synonyms, typed.synonyms),
    meanings: mergeList(existing.meanings, typed.meanings),
    sentences: mergeList(existing.sentences, typed.sentences),
  };
}
