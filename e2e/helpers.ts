import { expect, type Page } from '@playwright/test';

// Same account as src/e2e/fakeServices.ts.
export const ACCOUNT = { email: 'yali@example.com', password: 'leitner-e2e' };

/** 08:00 UTC = 11:30 in Tehran, the profile's time zone. */
export const DAY_1 = new Date('2026-03-10T08:00:00Z');
export const DAY_2 = new Date('2026-03-11T08:00:00Z');

export async function signIn(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByLabel('Email').fill(ACCOUNT.email);
  await page.getByLabel('Password').fill(ACCOUNT.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export interface Word {
  word: string;
  similar: string;
  persian: string;
  sentence: string;
}

export const BRAVE: Word = {
  word: 'brave',
  similar: 'bold, daring',
  persian: 'شجاع',
  sentence: 'It was a brave thing to say.',
};

export const CALM: Word = {
  word: 'calm',
  similar: 'quiet, peaceful',
  persian: 'آرام',
  sentence: 'Stay calm and carry on.',
};

export const QUIET: Word = {
  word: 'quiet',
  similar: 'silent, still',
  persian: 'ساکت',
  sentence: 'The library was quiet.',
};

/**
 * Fills the open "New word" sheet and saves it. The sheet stays open for the next word
 * (canvas N4): wait for the "saved" toast and the empty word field.
 */
export async function typeAndSave(page: Page, word: Word): Promise<void> {
  const sheet = page.getByRole('dialog', { name: 'New word' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('The word').fill(word.word);
  await sheet.getByLabel('Similar words').fill(word.similar);
  await sheet.getByLabel('In Persian').fill(word.persian);
  await sheet.getByLabel('Sentence 1', { exact: true }).fill(word.sentence);
  await sheet.getByRole('button', { name: 'Save word' }).click();
  await expect(page.getByRole('status').filter({ hasText: `${word.word} saved` })).toBeVisible();
  await expect(sheet.getByLabel('The word')).toHaveValue('');
}

/** Saves one word, then closes the sheet with ✕. */
export async function saveWord(page: Page, word: Word): Promise<void> {
  await typeAndSave(page, word);
  const sheet = page.getByRole('dialog', { name: 'New word' });
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
}

/** The card front: one big button ("tap to flip" with touch, "click or press space" otherwise). */
export const cardFront = (page: Page) =>
  page.getByRole('button', { name: /tap to flip|press space/ });

/** Text read by screen readers only (e.g. "2-day streak" on the top-bar pill). */
export const spoken = (page: Page, text: string) => page.getByText(text, { exact: true });

/** The top-bar +: with several decks on it rolls out one button per deck (canvas N2). */
export async function addTo(page: Page, deck: 'Vocab' | 'Spelling' | 'Phrases'): Promise<void> {
  await page.getByRole('button', { name: 'Add word', exact: true }).click();
  await page
    .getByRole('group', { name: 'Add to which deck?' })
    .getByRole('button', { name: deck })
    .click();
}
