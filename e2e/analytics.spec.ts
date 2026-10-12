import { expect, test } from '@playwright/test';

test('the static site makes no Vercel or analytics requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('./?token=private#services');
  await expect(page.locator('#language-selector')).toBeEnabled();
  await expect(page.locator('script[src*="_vercel"]')).toHaveCount(0);
  expect(requests.some((url) => /vercel|insights/.test(url))).toBe(false);
});
