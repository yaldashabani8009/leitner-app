import { expect, test } from '@playwright/test';

/**
 * After every deploy (roadmap step 8): the live site is installable and opens offline.
 * Read-only: it never signs in, so nothing touches the real account.
 */

test('the live site loads with the manifest and icons needed to install it', async ({
  page,
  request,
}) => {
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
  expect(manifest).toMatchObject({ name: 'Leitner', display: 'standalone' });

  for (const src of [
    ...manifest.icons.map((icon: { src: string }) => icon.src),
    'icons/apple-touch-icon.png',
  ]) {
    expect((await request.get(new URL(src, page.url()).href)).status(), src).toBe(200);
  }
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('the live site opens with no connection once the app is cached', async ({
  page,
  context,
  browserName,
}) => {
  // Playwright's WebKit can't reload through a service worker while offline (ADR-017).
  test.skip(browserName === 'webkit', "Playwright's WebKit can't reload offline");

  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 30_000,
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
