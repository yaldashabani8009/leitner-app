/**
 * Comma lists (Yali, 2026-10-29): similar words and Persian meanings are typed in one field,
 * separated by a comma "," or a Persian comma "،". Sentences are never split (they contain commas).
 */

import type { EntryInput } from './validate';

const SEPARATOR = /[,،]/;

/** "careful, precise,, thorough " → ["careful", "precise", "thorough"]; repeats are kept once. */
export function splitList(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const piece of text.split(SEPARATOR)) {
    const item = piece.trim().replace(/\s+/g, ' ');
    const key = item.toLowerCase();
    if (item === '' || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/** The saved items shown in one field: ", " between English items, "، " between Persian ones. */
export function joinList(items: readonly string[], persian = false): string {
  return items.join(persian ? '، ' : ', ');
}

/**
 * Turns the field's text back into list items for saving. An item whose text is unchanged
 * keeps its saved id, so editing only syncs what really changed (ADR-003); items that are
 * gone are left out, and the repository soft-deletes them.
 */
export function itemsFromText(
  text: string,
  saved: readonly { id: string; text: string }[] = [],
): EntryInput[] {
  const unused = [...saved];
  return splitList(text).map((item) => {
    const index = unused.findIndex((entry) => entry.text.toLowerCase() === item.toLowerCase());
    if (index === -1) return { text: item };
    const [entry] = unused.splice(index, 1);
    return { id: entry.id, text: item };
  });
}
