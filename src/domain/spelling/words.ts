/**
 * Adding spelling words (v3 brief 1.2, canvas P3–P4): a pasted list becomes clean words.
 * Pure: no storage, no UI.
 */

/** New lines and commas (English and Persian), in any mix. Spaces inside a piece don't split it. */
const SEPARATORS = /[\n\r,،]+/;
/** A list marker at the start: "1.", "2)", "-", "•", "*", "·", "–". */
const LIST_MARKER = /^(?:\d+[.)]|[-•*·–])\s*/;
/** Punctuation trimmed from both ends; apostrophes and hyphens inside a word stay. */
const EDGE_PUNCTUATION = /^[.;:!?"“”()[\]]+|[.;:!?"“”()[\]]+$/g;

/** One pasted piece, tidied: spaces, a list marker and stray punctuation removed. "" = drop it. */
export function tidyPiece(piece: string): string {
  let text = piece.trim().replace(/\s+/g, ' ');
  // Markers and punctuation can come in any order ("1. “word”"): repeat until nothing changes.
  for (;;) {
    const next = text.replace(LIST_MARKER, '').replace(EDGE_PUNCTUATION, '').trim();
    if (next === text) return text;
    text = next;
  }
}

/** Same word, ignoring capitals: the key for repeats and "already there". */
export function spellingKey(word: string): string {
  return word.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The words in a paste, in order: split on new lines and commas, each piece tidied, empty ones
 * and repeats (ignoring capitals; the first spelling wins) dropped. Capitals are kept as typed.
 */
export function splitWords(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const piece of text.split(SEPARATORS)) {
    const word = tidyPiece(piece);
    const key = spellingKey(word);
    if (word === '' || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

/**
 * A word that looks odd (dashed chip, P4): a digit, a Persian or Arabic letter or any other
 * non-Latin letter, or more than 3 words. It is still saved unless removed.
 */
export function looksOdd(word: string): boolean {
  if (/\d/.test(word)) return true;
  // Any letter outside Latin (accents included in Latin): Persian, Arabic, Cyrillic, Greek…
  if (/[^\p{Script=Latin}\P{L}]/u.test(word)) return true;
  return word.trim().split(/\s+/).length > 3;
}

export type ChipKind = 'new' | 'already' | 'odd';

/** What a checked word is (P4): already in the Spelling deck, odd-looking, or plain new. */
export function chipKind(word: string, existing: ReadonlySet<string>): ChipKind {
  if (existing.has(spellingKey(word))) return 'already';
  return looksOdd(word) ? 'odd' : 'new';
}
