import { expect, test } from '@playwright/test';
import { chooseLanguage } from './preferences';

test('the global contact support flag controls the whole card in both languages', async ({
  page
}) => {
  const enabled = process.env.STATUS_E2E_SUPPORT_ENABLED === 'true';
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect((await response!.text()).includes('id="support-heading"')).toBe(enabled);

  for (const locale of ['en', 'ru'] as const) {
    await chooseLanguage(page, locale);
    await expect(page.locator('.support-section')).toHaveCount(enabled ? 1 : 0);
    await expect(page.locator('a[href="https://brea4.space/app/support"]')).toHaveCount(
      enabled ? 1 : 0
    );
    await expect(page.locator('.site-footer')).toBeVisible();
  }
});
