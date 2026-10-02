import type { Page } from '@playwright/test';

export async function pollStatus(page: Page) {
  const response = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/status'
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await response;
}
