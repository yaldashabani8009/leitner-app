import { expect, test } from '@playwright/test';
import {
  BRAVE,
  CALM,
  DAY_1,
  DAY_2,
  QUIET,
  cardFront,
  saveWord,
  signIn,
  spoken,
  typeAndSave,
} from './helpers';

test('sign in, add words, then review them the next day', async ({ page }) => {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);

  // A new box opens on Today: the empty Vocab deck adds the first word, the top bar + the second.
  await expect(page.getByRole('heading', { name: 'Hi Yali!' })).toBeVisible();
  await page.getByRole('button', { name: 'Vocab, empty. Add words' }).click();
  await saveWord(page, BRAVE);
  await expect(page.getByRole('button', { name: 'Vocab, all done for today' })).toBeVisible();
  await page.getByRole('button', { name: 'Add word' }).click();
  await saveWord(page, CALM);
  // Nothing was due and a word was added: day 1 counts for the streak.
  await expect(spoken(page, '1-day streak')).toBeAttached();
  await expect(spoken(page, '2 cards in your box')).toBeAttached();

  // The next day both words are due: Today → Mix them all.
  await page.clock.setFixedTime(DAY_2);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vocab, 2 waiting. Start' })).toBeVisible();
  await page.getByRole('button', { name: /Mix them all/ }).click();

  // First card: tap to flip, then "Knew it!".
  await cardFront(page).click();
  await expect(page.getByLabel(/^Answer for /)).toBeVisible();
  await page.getByRole('button', { name: 'Knew it!' }).click();

  // Home (no "are you sure?"), then Continue where it stopped.
  await expect(cardFront(page)).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Vocab, paused · 1 left. Continue' }).click();

  // Second card with the keyboard: Space flips, ← is "Not yet".
  await expect(cardFront(page)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByLabel(/^Answer for /)).toBeVisible();
  await page.keyboard.press('ArrowLeft');

  // The miss comes back once as practice.
  await expect(page.getByText('Practice round')).toBeVisible();
  await cardFront(page).click();
  await page.getByRole('button', { name: 'Knew it!' }).click();

  await expect(page.getByRole('heading', { name: 'Session complete!' })).toBeVisible();
  await expect(page.getByText('You went through 2 words. Nice work.')).toBeVisible();
  await expect(page.getByText('2 days in a row!')).toBeVisible();

  await page.getByRole('button', { name: 'Done for today' }).click();
  await expect(page.getByRole('button', { name: 'Vocab, all done for today' })).toBeVisible();
  await expect(spoken(page, '2 cards in your box')).toBeAttached();
  await expect(spoken(page, '2-day streak')).toBeAttached();
});

test('a wrong password is explained, and nothing opens', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Email').fill('yali@example.com');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText("That email and password don't match. Try again?")).toBeVisible();
});

test('add 3 words in a row: the sheet stays open between them (canvas N4)', async ({ page }) => {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);
  await page.getByRole('button', { name: 'Vocab, empty. Add words' }).click();
  const sheet = page.getByRole('dialog', { name: 'New word' });
  await expect(sheet.getByText('Vocab', { exact: true })).toBeVisible();
  for (const word of [BRAVE, CALM, QUIET]) await typeAndSave(page, word);
  // The cursor is back in the word field, ready for the next one.
  await expect(sheet.getByLabel('The word')).toBeFocused();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
  await expect(spoken(page, '3 cards in your box')).toBeAttached();
});

test('the same word twice: the form fills in and "Save & start over" keeps one card (canvas N5)', async ({
  page,
}) => {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);
  await page.getByRole('button', { name: 'Vocab, empty. Add words' }).click();
  await typeAndSave(page, BRAVE);

  const sheet = page.getByRole('dialog', { name: 'New word' });
  await sheet.getByLabel('The word').fill('Brave');
  await sheet.getByLabel('Similar words').focus();
  await expect(sheet.getByText('Already in your Vocab box')).toBeVisible();
  await expect(sheet.getByLabel('Similar words')).toHaveValue('bold, daring');
  await sheet.getByRole('button', { name: 'Save & start over' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Brave updated · back to the start' }),
  ).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(spoken(page, '1 card in your box')).toBeAttached();
});
