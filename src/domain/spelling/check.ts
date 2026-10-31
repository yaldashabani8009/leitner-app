/**
 * Checking a typed spelling (v3 brief 1.3, canvas P5–P6). Pure.
 * Both sides are normalised (trim, one space inside, lower case, ’ ‘ ʼ as '), then must be
 * exactly equal: hyphens and everything else count.
 */

const CURLY_APOSTROPHES = /[’‘ʼ]/g;

/** The normalised letters, each with the original letter it came from (for display). */
function normalizedLetters(text: string): { norm: string; shown: string }[] {
  const out: { norm: string; shown: string }[] = [];
  const trimmed = text.trim();
  let lastWasSpace = false;
  for (const char of trimmed) {
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      out.push({ norm: ' ', shown: ' ' });
      continue;
    }
    lastWasSpace = false;
    const shown = char.replace(CURLY_APOSTROPHES, "'");
    out.push({ norm: shown.toLowerCase(), shown: char });
  }
  return out;
}

export function normalizeAnswer(text: string): string {
  return normalizedLetters(text)
    .map((letter) => letter.norm)
    .join('');
}

/** Is the typed answer the word? */
export function isCorrectSpelling(typed: string, word: string): boolean {
  return normalizeAnswer(typed) === normalizeAnswer(word);
}

/**
 * One step of the letter-by-letter comparison (P6):
 * - same: the letter is right;
 * - extra: typed but not in the word (crossed out);
 * - missing: in the word but not typed (an aqua gap in yours, highlighted in the word);
 * - wrong: a different letter in the same place (pale terracotta in yours, highlighted in the word).
 */
export type LetterStep =
  | { kind: 'same'; typed: string; word: string }
  | { kind: 'extra'; typed: string }
  | { kind: 'missing'; word: string }
  | { kind: 'wrong'; typed: string; word: string };

/**
 * The cheapest way to turn what was typed into the word (edit distance: insert, delete or
 * replace one letter), as steps, on the normalised letters but showing the original ones.
 */
export function compareLetters(typed: string, word: string): LetterStep[] {
  const a = normalizedLetters(typed);
  const b = normalizedLetters(word);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const cost: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const same = a[i - 1].norm === b[j - 1].norm ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + same, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  // Walk back from the end. On a tie, a matching letter first, then a missing or extra letter,
  // and a wrong letter last: "recieve" reads as one i and one e swapped, not two wrong letters.
  const steps: LetterStep[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].norm === b[j - 1].norm && cost[i][j] === cost[i - 1][j - 1]) {
      steps.push({ kind: 'same', typed: a[i - 1].shown, word: b[j - 1].shown });
      i--;
      j--;
    } else if (j > 0 && cost[i][j] === cost[i][j - 1] + 1) {
      steps.push({ kind: 'missing', word: b[j - 1].shown });
      j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      steps.push({ kind: 'extra', typed: a[i - 1].shown });
      i--;
    } else {
      steps.push({ kind: 'wrong', typed: a[i - 1].shown, word: b[j - 1].shown });
      i--;
      j--;
    }
  }
  return steps.reverse();
}

const spell = (text: string) =>
  [...text.trim()].map((char) => (char === ' ' ? 'space' : char)).join(', ');

/** For screen readers: both words spelled letter by letter (P6). */
export function spokenComparison(typed: string, word: string): string {
  return `You typed ${spell(typed)}. The word is ${spell(word)}.`;
}
