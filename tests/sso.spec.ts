import { expect, test } from '@playwright/test';

test('both household identities sign in, survive reload, and sign out through real app routes', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'cookbook.session_token',
      value: 'foreign-app-session',
      domain: 'localhost',
      path: '/',
    },
  ]);
  for (const [name, email] of [
    ['Household One', 'one@example.test'],
    ['Household Two', 'two@example.test'],
  ]) {
    await page.goto('/');
    const signIn = page.getByRole('button', { name: 'Sign in with Pior Labs' });
    await expect(signIn).toBeVisible();
    await signIn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Fixture central SSO' })).toBeVisible();
    await page.getByRole('link', { name }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    const me = await page.request.get('/api/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).user.email).toBe(email);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(signIn).toBeVisible();
    await page.reload();
    await expect(signIn).toBeVisible();
    expect((await page.request.get('/api/me')).status()).toBe(401);
  }
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'cookbook.session_token')?.value,
  ).toBe('foreign-app-session');
});

test('sign-in errors are visible and retryable', async ({ page }) => {
  await page.goto('/?error=sign-in');
  await expect(page.getByRole('alert')).toContainText('Sign-in did not complete');
  await page.route('**/api/auth/sign-in/oauth2', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page.getByRole('button', { name: 'Sign in with Pior Labs' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not start sign-in');
  await expect(page.getByRole('button', { name: 'Sign in with Pior Labs' })).toBeEnabled();
});
