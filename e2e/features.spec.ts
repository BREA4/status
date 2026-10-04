import { expect, test } from '@playwright/test';
import { chooseLanguage } from './preferences';
import { emptySnapshot } from '../src/lib/status';
import { pollStatus } from './status-poll';

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

test('polling removes disabled services and empty groups, then restores re-enabled services', async ({
  page
}) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  let snapshot = emptySnapshot();
  snapshot.components = snapshot.components.filter(({ id }) => id === 'update-server');
  snapshot.components[0].status = 'operational';
  snapshot.components[0].checkedAt = snapshot.generatedAt;
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await expect(page.locator('.service-group')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All systems operational');
  await page.getByRole('button', { name: /Breach app/ }).click();
  await expect(page.locator('.component-title')).toHaveText('Update server');
  await page.locator('.component-toggle').click();
  await expect(page.locator('.history-bars')).toBeVisible();
  snapshot = { ...snapshot, components: [] };
  await pollStatus(page);
  await expect(page.locator('.service-group')).toHaveCount(0);
  await expect(page.locator('.history-bars')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Status unavailable');
  snapshot = emptySnapshot();
  snapshot.components = snapshot.components.filter(({ id }) => id === 'website');
  await pollStatus(page);
  await expect(page.locator('.service-group')).toHaveCount(1);
  await expect(page.locator('.component-title')).toHaveText('Website');
});
