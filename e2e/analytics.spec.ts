import { expect, test } from '@playwright/test';

test('only production starts analytics, using the existing same-origin CSP', async ({ page }) => {
  await page.route('**/_vercel/insights/script.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.statusAnalyticsLoaded = true;'
    })
  );
  await page.goto('/?token=private#services');
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeEnabled();
  const tracker = page.locator('script[src="/_vercel/insights/script.js"]');
  if (process.env.VERCEL_ENV === 'production') {
    await expect(tracker).toHaveCount(1);
    await expect.poll(() => page.evaluate('window.statusAnalyticsLoaded')).toBe(true);
  } else {
    await expect(tracker).toHaveCount(0);
    expect(await page.evaluate('window.statusAnalyticsLoaded')).toBeUndefined();
  }
});
