import { expect, test } from '@playwright/test';
import { messages } from '../src/lib/i18n';
import { emptySnapshot, type Status } from '../src/lib/status';

test.use({ reducedMotion: 'reduce' });

test('shows a compact status row without radar or monitoring controls', async ({
  page
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.status-summary')).toBeVisible();
  await expect(page.locator('.summary-dot')).toBeVisible();
  await expect(
    page.locator(
      '.hero, .signal-art, .coverage, .update-strip, .refresh-button, .refresh-announcement'
    )
  ).toHaveCount(0);
  const bounds = await page.locator('.status-summary').boundingBox();
  expect(bounds!.height).toBeLessThan(150);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveAttribute('aria-live', 'polite');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${colorScheme}-status-summary.png`,
      fullPage: true
    });
  }
});

test('service details contain only the 90-day history', async ({ page }, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  await page.goto('/');
  await page.locator('.component-toggle').first().click();
  const detail = page.locator('.component-detail');
  await expect(detail.locator(':scope > *')).toHaveCount(1);
  await expect(detail.locator('.history-block')).toBeVisible();
  await expect(detail).toContainText(t.history);
  await expect(detail.locator('.history-bar')).toHaveCount(90);
  await expect(page.locator('#services')).not.toContainText('brea4.space');
  await expect(page.locator('.monitoring-note, .detail-note, .detail-time, .latency')).toHaveCount(
    0
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-service-history.png`,
    fullPage: true
  });
});

test('automatically updates the headline from reported data and incidents', async ({
  page
}, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  let time = Date.now();
  await page.clock.install({ time: new Date(time) });
  let snapshot = emptySnapshot(time);
  let requests = 0;
  await page.route('**/api/status', (route) => {
    requests++;
    return route.fulfill({ json: snapshot });
  });
  await page.goto('/');
  await expect(page.locator('#language-selector')).toBeEnabled();
  const headline = page.getByRole('heading', { level: 1 });
  const dot = page.locator('.summary-dot');
  const colors = {
    light: {
      operational: 'rgb(119, 163, 98)',
      degraded: 'rgb(200, 152, 61)',
      partial_outage: 'rgb(175, 83, 73)',
      outage: 'rgb(175, 83, 73)',
      maintenance: 'rgb(116, 119, 163)',
      unknown: 'rgb(146, 155, 145)'
    },
    dark: {
      operational: 'rgb(172, 211, 135)',
      degraded: 'rgb(232, 189, 110)',
      partial_outage: 'rgb(237, 151, 138)',
      outage: 'rgb(237, 151, 138)',
      maintenance: 'rgb(181, 175, 232)',
      unknown: 'rgb(135, 151, 129)'
    }
  };
  let colorScheme: 'light' | 'dark' = 'light';

  async function poll(statuses: Status[], expected: keyof typeof t.headline, incident = false) {
    time += 61_000;
    snapshot = emptySnapshot(time);
    statuses.forEach((status, index) =>
      Object.assign(snapshot.components[index], {
        status,
        checkedAt: snapshot.generatedAt
      })
    );
    if (incident)
      snapshot.incidents = [
        {
          id: 'current-incident',
          title: { en: 'Connection interruption', ru: 'Сбой подключения' },
          status: 'investigating',
          impact: 'outage',
          startedAt: snapshot.generatedAt,
          updatedAt: snapshot.generatedAt,
          components: ['riga-tuic'],
          updates: []
        }
      ];
    const previous = requests;
    await page.clock.fastForward(61_000);
    await expect.poll(() => requests).toBeGreaterThan(previous);
    await expect(headline).toHaveText(t.headline[expected]);
    await expect(dot).toHaveCSS('background-color', colors[colorScheme][expected]);
    await expect(dot).toHaveCSS('border-radius', '50%');
  }

  for (colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await poll(['operational', 'operational'], 'operational');
    await expect(page.locator('.status-pill.unknown').first()).toContainText(t.status.unknown);
    await poll(Array(14).fill('operational'), 'operational');
    await poll(['degraded'], 'degraded');
    await poll(['partial_outage'], 'partial_outage');
    await poll(['outage'], 'outage');
    await poll(['maintenance'], 'maintenance');
    await poll(['operational'], 'outage', true);
    await poll(['operational'], 'operational');
    await poll([], 'unknown');
  }

  // Fresh successes must expire even when the API can no longer be reached.
  await poll(Array(14).fill('operational'), 'operational');
  await page.route('**/api/status', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.clock.fastForward(6 * 60_000);
  await expect(headline).toHaveText(t.headline.unknown);
  await expect(dot).toHaveCSS('background-color', colors[colorScheme].unknown);
});
