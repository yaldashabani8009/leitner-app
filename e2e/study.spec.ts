import { expect, test } from '@playwright/test';
import { BRAVE, CALM, DAY_1, DAY_2, cardFront, saveWord, signIn, spoken } from './helpers';

test('sign in, add words, then review them the next day', async ({ page }) => {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);

  // A new box: add the first word from the empty screen, the second from the top bar.
  await expect(page.getByRole('heading', { name: 'Your box is empty' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a new word' }).click();
  await saveWord(page, BRAVE);
  await expect(page.getByRole('heading', { name: 'All done for today' })).toBeVisible();
  await page.getByRole('button', { name: 'Add word' }).click();
  await saveWord(page, CALM);
  // Nothing was due and a word was added: day 1 counts for the streak.
  await expect(spoken(page, '1-day streak')).toBeAttached();
  await expect(spoken(page, '0 words learned')).toBeAttached();

  // The next day both words are due.
  await page.clock.setFixedTime(DAY_2);
  await page.reload();

  // First card: tap to flip, then "Knew it!".
  await cardFront(page).click();
  await expect(page.getByLabel(/^Answer for /)).toBeVisible();
  await page.getByRole('button', { name: 'Knew it!' }).click();

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

  await page.getByRole('button', { name: "I'm done for now" }).click();
  await expect(page.getByRole('heading', { name: 'All done for today' })).toBeVisible();
  await expect(spoken(page, '1 word learned')).toBeAttached();
  await expect(spoken(page, '2-day streak')).toBeAttached();
});

test('a wrong password is explained, and nothing opens', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Email').fill('yali@example.com');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText("That email and password don't match. Try again?")).toBeVisible();
});

test('the same word twice opens the existing card instead of a copy', async ({ page }) => {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);
  await page.getByRole('button', { name: 'Add a new word' }).click();
  await saveWord(page, BRAVE);
  await page.getByRole('button', { name: 'Add word' }).click();

  const sheet = page.getByRole('dialog', { name: 'New word' });
  await sheet.getByLabel('The word').fill('Brave');
  await sheet.getByRole('button', { name: 'Save word' }).click();
  await page.getByRole('button', { name: 'Open my card' }).click();
  await expect(page.getByLabel('Your card: brave')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'All done for today' })).toBeVisible();
});
