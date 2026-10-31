import { describe, expect, it } from 'vitest';
import { compareLetters, isCorrectSpelling, normalizeAnswer, spokenComparison } from './check';
import { HOMOPHONE_GROUP_COUNT, soundsAlike } from './homophones';
import { chipKind, looksOdd, spellingKey, splitWords, tidyPiece } from './words';

describe('splitWords (v3 brief 1.2, canvas P3)', () => {
  it.each([
    ['new lines', 'necessary\nreceive\nseparate', ['necessary', 'receive', 'separate']],
    ['commas', 'necessary, receive,separate', ['necessary', 'receive', 'separate']],
    ['Persian commas', 'necessary، receive', ['necessary', 'receive']],
    [
      'a mix',
      'necessary, receive\nseparate,\n\nrhythm',
      ['necessary', 'receive', 'separate', 'rhythm'],
    ],
    ['spaces inside do not split', 'ice cream\n  ice   cream  ', ['ice cream']],
    ['Windows line ends', 'one\r\ntwo\r\n', ['one', 'two']],
    ['repeats, first spelling wins', 'Wednesday\nwednesday\nWEDNESDAY', ['Wednesday']],
    ['empty input', '  \n , ,\n', []],
  ])('%s', (_label, text, words) => {
    expect(splitWords(text)).toEqual(words);
  });

  it('cleans Live Text junk: numbers, bullets, stray punctuation', () => {
    const pasted = [
      '1. necessary',
      '2) receive;',
      '- separate.',
      '• rhythm!',
      '* embarrass?',
      '· occurrence:',
      '– definitely',
      '"accommodate"',
      '“privilege”',
      '(friend)',
      '[believe]',
      "don't",
      'well-known.',
      '3.  “ice cream”',
    ].join('\n');
    expect(splitWords(pasted)).toEqual([
      'necessary',
      'receive',
      'separate',
      'rhythm',
      'embarrass',
      'occurrence',
      'definitely',
      'accommodate',
      'privilege',
      'friend',
      'believe',
      "don't",
      'well-known',
      'ice cream',
    ]);
  });

  it('tidyPiece keeps apostrophes and hyphens inside, drops pieces that were only marks', () => {
    expect(tidyPiece("  rock'n'roll  ")).toBe("rock'n'roll");
    expect(tidyPiece('-')).toBe('');
    expect(tidyPiece('...')).toBe('');
    expect(tidyPiece('12.')).toBe('');
  });
});

describe('looksOdd / chipKind (canvas P4)', () => {
  it.each([
    ['necessary', false],
    ['ice cream', false],
    ['café', false],
    ['break the ice', false],
    ['pg 12', true],
    ['abc1', true],
    ['کتاب', true],
    ['كتاب', true],
    ['привет', true],
    ['a very long phrase here', true],
  ])('%s → %s', (word, odd) => {
    expect(looksOdd(word)).toBe(odd);
  });

  it('already in the Spelling deck beats odd; otherwise new or odd', () => {
    const existing = new Set(['necessary', 'pg 12']);
    expect(chipKind('Necessary', existing)).toBe('already');
    expect(chipKind('pg 12', existing)).toBe('already');
    expect(chipKind('receive', existing)).toBe('new');
    expect(chipKind('pg 13', existing)).toBe('odd');
    expect(spellingKey('  Ice   Cream ')).toBe('ice cream');
  });
});

describe('checking an answer (v3 brief 1.3)', () => {
  it.each([
    ['receive', 'receive', true],
    ['  Receive ', 'receive', true],
    ['ice  cream', 'ice cream', true],
    ['don’t', "don't", true],
    ['don‘t', "don't", true],
    ['donʼt', "don't", true],
    ['recieve', 'receive', false],
    ['well known', 'well-known', false],
    ['icecream', 'ice cream', false],
  ])('%s vs %s → %s', (typed, word, correct) => {
    expect(isCorrectSpelling(typed, word)).toBe(correct);
  });

  it('normalises both sides the same way', () => {
    expect(normalizeAnswer('  Don’t   Stop ')).toBe("don't stop");
  });
});

describe('compareLetters (canvas P6)', () => {
  const view = (typed: string, word: string) =>
    compareLetters(typed, word)
      .map((s) =>
        s.kind === 'same'
          ? s.word
          : s.kind === 'extra'
            ? `[-${s.typed}]`
            : s.kind === 'missing'
              ? `[+${s.word}]`
              : `[${s.typed}>${s.word}]`,
      )
      .join('');

  it.each([
    ['receive', 'receive', 'receive'],
    ['reciev', 'receive', 'rec[-i]e[+i]v[+e]'],
    ['neccessary', 'necessary', 'ne[-c]cessary'],
    ['necesary', 'necessary', 'nece[+s]sary'],
    ['seperate', 'separate', 'sep[e>a]rate'],
    ['', 'cat', '[+c][+a][+t]'],
    ['cat', '', '[-c][-a][-t]'],
  ])('%s vs %s', (typed, word, shown) => {
    expect(view(typed, word)).toBe(shown);
  });

  it('shows the original letters (capitals, curly apostrophes) while comparing normalised ones', () => {
    expect(compareLetters('Don’t', "don't").map((s) => s.kind)).toEqual(Array(5).fill('same'));
    expect(compareLetters('Don’t', "don't")[0]).toEqual({ kind: 'same', typed: 'D', word: 'd' });
    expect(compareLetters('ice  cream', 'ice cream').every((s) => s.kind === 'same')).toBe(true);
  });

  it('spells both words for screen readers', () => {
    expect(spokenComparison('recieve', 'receive')).toBe(
      'You typed r, e, c, i, e, v, e. The word is r, e, c, e, i, v, e.',
    );
    expect(spokenComparison('ice cream', 'ice-cream')).toContain('i, c, e, space, c');
  });
});

describe('sound-alike words (canvas P7)', () => {
  it('has a few hundred groups', () => {
    expect(HOMOPHONE_GROUP_COUNT).toBeGreaterThan(250);
  });

  it.each([
    ['there', 'their', true],
    ["they're", 'there', true],
    ['they’re', 'their', true],
    ['right', 'write', true],
    ['two', 'too', true],
    ['Their', 'there', true],
    ['there', 'there', false],
    ['there', 'three', false],
    ['xyz', 'there', false],
    ['there', 'xyz', false],
    ['write', 'rite', true],
    ['read', 'red', true],
    ['read', 'reed', true],
    ['red', 'reed', false],
  ])('%s / %s → %s', (typed, word, alike) => {
    expect(soundsAlike(typed, word)).toBe(alike);
  });
});
