import { expect, test } from '@playwright/test';
import { BRAVE, CALM, DAY_1, DAY_2, cardFront, saveWord, signIn } from './helpers';

test('opens offline with the words still there, and keeps working', async ({ page, context }) => {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);
  await page.getByRole('button', { name: 'Add a new word' }).click();
  await saveWord(page, BRAVE);
  await expect(page.getByRole('heading', { name: 'All done for today' })).toBeVisible();

  // The service worker has the whole app cached once it controls the page.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 30_000,
  });

  // No connection at all: the app still opens, on the box, not on Sign in.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All done for today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);

  // Adding a word works offline; it waits on the device for the cloud.
  await page.getByRole('button', { name: 'Add word' }).click();
  await saveWord(page, CALM);

  // Still offline the next day: both words are due.
  await page.clock.setFixedTime(DAY_2);
  await page.reload();
  await cardFront(page).click();
  await page.getByRole('button', { name: 'Knew it!' }).click();
  await cardFront(page).click();
  await page.getByRole('button', { name: 'Knew it!' }).click();
  await expect(page.getByRole('heading', { name: 'Session complete!' })).toBeVisible();
});
