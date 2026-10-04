import { expect, test } from '@playwright/test';
import { messages } from '../src/lib/i18n';
import { currentStatus, summarize, type Snapshot } from '../src/lib/status';

test('applies real API responses immediately and when focus or connectivity returns', async ({
  page
}, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  const firstPoll = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/status'
  );
  await page.goto('/');
  const firstResponse = await firstPoll;
  expect(firstResponse.status()).toBe(200);
  const initial = (await firstResponse.json()) as Snapshot;
  await expect(page.locator('.status-summary')).toHaveAttribute(
    'data-generated-at',
    initial.generatedAt
  );
  await expect(page.locator('h1')).toHaveText(
    t.headline[
      summarize(
        initial.components.map((component) =>
          currentStatus(component, Date.now(), initial.incidents)
        )
      )
    ]
  );
  expect(
    initial.components.every(({ source, status }) => source !== 'none' || status === 'unknown')
  ).toBe(true);

  for (const event of ['focus', 'online']) {
    const response = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/status'
    );
    await page.evaluate((event) => window.dispatchEvent(new Event(event)), event);
    const result = await response;
    expect(result.status()).toBe(200);
    const snapshot = (await result.json()) as Snapshot;
    await expect(page.locator('.status-summary')).toHaveAttribute(
      'data-generated-at',
      snapshot.generatedAt
    );
  }
});
