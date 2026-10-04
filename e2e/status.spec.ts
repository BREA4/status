import { expect, test } from '@playwright/test';
import { emptySnapshot } from '../src/lib/status';
import { messages } from '../src/lib/i18n';
import { chooseLanguage } from './preferences';
import { pollStatus } from './status-poll';

test('waits for hydration before accepting a language click', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_app/immutable/entry/start*.js', async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect(page.locator('#language-selector')).toBeDisabled();
  } finally {
    release();
  }
  await chooseLanguage(page, 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('detects language, persists a switch, and keeps layouts within the viewport', async ({
  page
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status(), 'The server must render a successful page').toBe(200);
  const russian = testInfo.project.name === 'mobile-ru';
  await expect(page.locator('html')).toHaveAttribute('lang', russian ? 'ru' : 'en');
  await expect(page.locator('.status-summary')).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-initial.png`,
    fullPage: true
  });
  expect(Object.values(messages[russian ? 'ru' : 'en'].headline)).toContain(
    await page.getByRole('heading', { level: 1 }).textContent()
  );
  await chooseLanguage(page, russian ? 'en' : 'ru');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', russian ? 'en' : 'ru');
  const dimensions = await page.evaluate(() => {
    const h1 = document.querySelector('h1')!;
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      lines: h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)
    };
  });
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.lines).toBeLessThanOrEqual(3.1);
  expect(errors).toEqual([]);
  await expect(page.locator('.status-summary')).toBeVisible();
  await page.screenshot({ path: `test-results/${testInfo.project.name}.png`, fullPage: true });
});

test('filters locations, expands protocols and exposes missing history', async ({ page }) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  // Keep this UI test independent of the linked project's changing service flags.
  await page.route('**/api/status', (route) => route.fulfill({ json: emptySnapshot() }));
  await pollStatus(page);
  await page.getByRole('button', { name: 'Network', exact: true }).click();
  await expect(page.locator('.service-group')).toHaveCount(3);
  await page.getByRole('button', { name: /Amsterdam/ }).click();
  await page.getByRole('button', { name: /VLESS Reality/ }).click();
  await expect(page.getByText('No recorded history', { exact: true })).toBeVisible();
  await expect(page.locator('.history-bar.unknown')).toHaveCount(90);
  await page.getByRole('button', { name: 'Expand all', exact: false }).click();
  await expect(page.locator('.group-toggle[aria-expanded="true"]')).toHaveCount(3);
});

test('shows 100% for one operational day while keeping unrecorded days empty', async ({ page }) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  const snapshot = emptySnapshot();
  const component = snapshot.components.find(({ id }) => id === 'update-server')!;
  component.history = [
    { date: snapshot.generatedAt.slice(0, 10), status: 'operational', uptime: null }
  ];
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await page.getByRole('button', { name: /Breach app/ }).click();
  await page.getByRole('button', { name: /Update server/ }).click();
  await expect(page.locator('.history-heading')).toHaveText('90-day history100%');
  await expect(page.locator('.history-bar.operational')).toHaveCount(1);
  await expect(page.locator('.history-bar.unknown')).toHaveCount(89);
  await expect(page.locator('.history-bar.operational')).toHaveAttribute(
    'title',
    /Operational · 100% availability from recorded status$/
  );
  await expect(page.locator('.history-bars')).toHaveAttribute(
    'aria-label',
    '90-day history. Uptime over recorded days: 100%'
  );
  await expect(page.locator('.history-bar.unknown').first()).toHaveAttribute(
    'title',
    /No measurement$/
  );
});

test('shows compact daily uptime and averages measured and recorded days', async ({ page }) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  const snapshot = emptySnapshot();
  const midnight = Date.parse(`${snapshot.generatedAt.slice(0, 10)}T00:00:00Z`);
  const component = snapshot.components.find(({ id }) => id === 'update-server')!;
  component.history = [99, 99.9, 99.98, 100, null].map((uptime, index) => ({
    date: new Date(midnight - (4 - index) * 86_400_000).toISOString().slice(0, 10),
    status: 'operational',
    uptime
  }));
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await page.getByRole('button', { name: /Breach app/ }).click();
  await page.getByRole('button', { name: /Update server/ }).click();
  await expect(page.locator('.history-heading')).toHaveText('90-day history99.78%');
  await expect(page.locator('.history-bars')).toHaveAttribute(
    'aria-label',
    '90-day history. Uptime over recorded days: 99.78%'
  );
  const bars = page.locator('.history-bar.operational');
  for (const [index, percentage] of ['99%', '99.9%', '99.98%', '100%'].entries()) {
    await expect(bars.nth(index)).toHaveAttribute(
      'title',
      new RegExp(`${percentage.replace('.', '\\.')} measured uptime$`)
    );
  }
  await expect(bars.nth(4)).toHaveAttribute('title', /100% availability from recorded status$/);
  await expect(page.locator('.history-bar.unknown')).toHaveCount(85);
  await chooseLanguage(page, 'ru');
  await expect(page.locator('.history-heading')).toHaveText('История за 90 дней99,78%');
  await expect(bars.nth(2)).toHaveAttribute('title', /99,98% измеренная доступность$/);
});

test('recorded downtime reduces uptime without counting missing or unknown days', async ({
  page
}) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  const snapshot = emptySnapshot();
  const midnight = Date.parse(`${snapshot.generatedAt.slice(0, 10)}T00:00:00Z`);
  const component = snapshot.components.find(({ id }) => id === 'update-server')!;
  component.history = ['operational', 'degraded', 'outage', 'unknown'].map((status, index) => ({
    date: new Date(midnight - (3 - index) * 86_400_000).toISOString().slice(0, 10),
    status: status as typeof component.status,
    uptime: null
  }));
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await page.getByRole('button', { name: /Breach app/ }).click();
  await page.getByRole('button', { name: /Update server/ }).click();
  await expect(page.locator('.history-heading')).toHaveText('90-day history66.67%');
  await expect(page.locator('.history-bar.outage')).toHaveAttribute(
    'title',
    /0% availability from recorded status$/
  );
  component.history = component.history.filter(({ status }) => status === 'unknown');
  await pollStatus(page);
  await expect(page.locator('.history-heading')).toHaveText('90-day historyNo data');
});

test('history cron rejects public requests before collecting checks', async ({ request }) => {
  const credentials: Record<string, string>[] = [{}, { Authorization: 'Bearer invalid' }];
  for (const headers of credentials) {
    const response = await request.get('/api/cron/history', { headers });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  }
});

test('retries failed background updates without exposing refresh controls', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await chooseLanguage(page, 'en');
  const snapshot = emptySnapshot(await page.evaluate(() => Date.now()));
  snapshot.components.forEach((component) => {
    component.status = 'operational';
    component.checkedAt = snapshot.generatedAt;
  });
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All systems operational');
  await page.route('**/api/status', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await pollStatus(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All systems operational');
  await expect(
    page.locator('.notice, .refresh-announcement, .refresh-button, .update-strip')
  ).toHaveCount(0);
  await page.clock.fastForward(6 * 60_000);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Status unavailable');
  snapshot.generatedAt = new Date(await page.evaluate(() => Date.now())).toISOString();
  snapshot.components.forEach((component) => (component.checkedAt = snapshot.generatedAt));
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await page.clock.fastForward(61_000);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All systems operational');
});

test('stale data cannot stay green, even after a successful fetch', async ({ page }) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  const snapshot = emptySnapshot(Date.now() - 600_000);
  snapshot.components.forEach((component) => {
    component.status = 'operational';
    component.checkedAt = snapshot.generatedAt;
  });
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Status unavailable');
  await expect(page.locator('.summary-dot')).toHaveClass(/unknown/);
});

test('incident updates are escaped, localized, and paginated', async ({ page }) => {
  await page.goto('/');
  await chooseLanguage(page, 'en');
  const snapshot = emptySnapshot();
  snapshot.incidents = Array.from({ length: 4 }, (_, index) => ({
    id: `incident-${index}`,
    title: { en: `Service update ${index}`, ru: `Обновление ${index}` },
    status: 'resolved',
    impact: 'degraded',
    startedAt: snapshot.generatedAt,
    updatedAt: snapshot.generatedAt,
    components: ['website'],
    updates: [
      {
        at: snapshot.generatedAt,
        message: { en: '<script>alert(1)</script>', ru: 'Работа восстановлена' }
      }
    ]
  }));
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await pollStatus(page);
  await expect(page.locator('.incident')).toHaveCount(3);
  await expect(page.locator('.incident-update').first()).toContainText('<script>alert(1)</script>');
  await expect(page.locator('.incident-update script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.incident')).toHaveCount(1);
  await chooseLanguage(page, 'ru');
  await expect(page.locator('.incident-update')).toContainText('Работа восстановлена');
});
