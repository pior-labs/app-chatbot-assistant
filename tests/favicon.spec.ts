import { expect, test } from '@playwright/test';

test('favicon links and manifest icons resolve to image assets', async ({ page }) => {
  await page.goto('/');

  for (const [rel, href] of [
    ['icon', '/favicon-96x96.png'],
    ['icon', '/favicon.svg'],
    ['shortcut icon', '/favicon.ico'],
    ['apple-touch-icon', '/apple-touch-icon.png'],
  ]) {
    await expect(page.locator(`head link[rel="${rel}"][href="${href}"]`)).toHaveCount(1);
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\//);
    expect((await response.body()).length).toBeGreaterThan(0);
  }

  await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/site.webmanifest',
  );
  const response = await page.request.get('/site.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.icons).toHaveLength(2);
  for (const icon of manifest.icons) {
    const image = await page.request.get(icon.src);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toMatch(/^image\/png/);
    expect((await image.body()).length).toBeGreaterThan(0);
  }
});
