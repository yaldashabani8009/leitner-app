import { expect, test, type Page } from '@playwright/test';
import { BRAVE, CALM, DAY_1, DAY_2, cardFront, saveWord, signIn } from './helpers';

/** Signs in on day 1, adds a word, and waits until the service worker has the app cached. */
async function readyWithOneWord(page: Page): Promise<void> {
  await page.clock.setFixedTime(DAY_1);
  await signIn(page);
  await page.getByRole('button', { name: 'Vocab, empty. Add words' }).click();
  await saveWord(page, BRAVE);
  await expect(page.getByRole('button', { name: 'Vocab, all done for today' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 30_000,
  });
}

test('keeps working when the connection drops', async ({ page, context }) => {
  await readyWithOneWord(page);
  await context.setOffline(true);

  // Adding a word works offline; it waits on the device for the cloud.
  await page.getByRole('button', { name: 'Add word' }).click();
  await saveWord(page, CALM);
  await expect(page.getByRole('button', { name: 'Vocab, all done for today' })).toBeVisible();
});

test('opens with no connection, with the words still there', async ({
  page,
  context,
  browserName,
}) => {
  // Playwright's WebKit can't load a page through a service worker while it simulates
  // "offline" ("WebKit encountered an internal error" on reload). The app's offline start is
  // the same code in every browser, so Chromium covers it (ADR-017).
  test.skip(browserName === 'webkit', "Playwright's WebKit can't reload offline");

  await readyWithOneWord(page);

  // No connection at all: the app still opens, on Today, not on Sign in.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vocab, all done for today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add word' }).click();
  await saveWord(page, CALM);

  // Still offline the next day: both words are due.
  await page.clock.setFixedTime(DAY_2);
  await page.reload();
  await page.getByRole('button', { name: 'Vocab, 2 waiting. Start' }).click();
  await cardFront(page).click();
  await page.getByRole('button', { name: 'Knew it!' }).click();
  await cardFront(page).click();
  await page.getByRole('button', { name: 'Knew it!' }).click();
  await expect(page.getByRole('heading', { name: 'Session complete!' })).toBeVisible();
});
