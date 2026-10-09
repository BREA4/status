import { expect, type Page, type Request } from '@playwright/test';

export async function pollStatus(page: Page) {
  let request: Request | undefined;
  const onRequest = (candidate: Request) => {
    if (!request && new URL(candidate.url()).pathname === '/api/status') request = candidate;
  };
  page.on('request', onRequest);
  try {
    // A startup poll may still be running, so retry the trigger until a new request begins.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
          return !!request;
        },
        { timeout: 30_000, message: 'A new status poll must begin' }
      )
      .toBe(true);
    const response = await request!.response();
    if (!response) throw new Error('Status poll failed before receiving a response');
    await response.finished();
  } finally {
    page.off('request', onRequest);
  }
}
