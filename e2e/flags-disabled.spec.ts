import { expect, test } from '@playwright/test';
import { chooseLanguage } from './preferences';
import { pollStatus } from './status-poll';

const light = 'rgb(248, 249, 245)';

test('disabled appearance stays light before hydration despite a saved dark preference', async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('breach-theme', 'dark'));
  let release!: () => void;
  const ready = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_app/immutable/entry/start*.js', async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect(page.locator('html')).toHaveCSS('background-color', light);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#theme-selector')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator('#language-selector')).toBeEnabled();
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
  await page.evaluate(() =>
    window.dispatchEvent(new StorageEvent('storage', { key: 'breach-theme', newValue: 'dark' }))
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('background-color', light);
  expect(await page.evaluate(() => localStorage.getItem('breach-theme'))).toBe('dark');
});

test('service flags control server HTML, status API, groups and polling in both languages', async ({
  page
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const html = await response!.text();
  expect(html).not.toContain('aria-controls="group-web"');
  expect(html).not.toContain('aria-controls="group-riga"');
  expect(html).not.toContain('aria-controls="group-moscow"');
  const api = await page.request.get('/api/status');
  expect(api.headers()['cache-control']).toBe('private, no-store');
  const snapshot = await api.json();
  expect(snapshot.components.map(({ id }: { id: string }) => id)).toEqual([
    'update-server',
    'amsterdam-reality'
  ]);
  expect(snapshot.components[0].status).toBe('operational');
  for (const locale of ['en', 'ru'] as const) {
    await chooseLanguage(page, locale);
    await expect(page.locator('.service-group')).toHaveCount(2);
    await page.locator('.expand-all').click();
    await expect(page.locator('.component-toggle')).toHaveCount(2);
    await expect(page.locator('.component-title').first()).toHaveText(
      locale === 'en' ? 'Update server' : 'Сервер обновлений'
    );
    await pollStatus(page);
    await expect(page.locator('.component-toggle')).toHaveCount(2);
    await page.locator('.expand-all').click();
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'dark' });
  test('disabled appearance renders light on the server', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('background-color', light);
    await expect(page.locator('#theme-selector')).toHaveCount(0);
    await expect(page.locator('.service-group')).toHaveCount(2);
  });
});
