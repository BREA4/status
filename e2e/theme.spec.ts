import { expect, test, type Page } from '@playwright/test';
import { messages } from '../src/lib/i18n';
import { emptySnapshot, type Status } from '../src/lib/status';

const backgrounds = { light: 'rgb(248, 249, 245)', dark: 'rgb(16, 22, 19)' };
const expectTheme = (page: Page, theme: keyof typeof backgrounds) =>
  expect(page.locator('html')).toHaveCSS('background-color', backgrounds[theme]);

test.use({ reducedMotion: 'reduce' });

test('follows device changes, remembers overrides, and returns to automatic mode', async ({
  page
}, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expectTheme(page, 'dark');
  await expect(page.getByRole('button', { name: t.theme.system })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
  await page.getByRole('button', { name: t.theme.dark, exact: true }).click();
  await page.reload();
  await expectTheme(page, 'dark');
  await expect(page.getByRole('button', { name: t.theme.dark, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: t.theme.light, exact: true }).click();
  await page.reload();
  await expectTheme(page, 'light');
  await page.getByRole('button', { name: t.theme.system }).click();
  await expectTheme(page, 'dark');
  await page.reload();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
});

test('applies a saved override before hydration and supports keyboard switching', async ({
  page
}, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('breach-theme', 'dark'));
  let release!: () => void;
  const ready = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_app/immutable/entry/start*.js', async (route) => {
    await ready;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expectTheme(page, 'dark');
    await expect(page.getByRole('button', { name: t.theme.dark, exact: true })).toBeDisabled();
  } finally {
    release();
  }
  const light = page.getByRole('button', { name: t.theme.light, exact: true });
  await expect(light).toBeEnabled();
  await light.focus();
  await page.keyboard.press('Enter');
  await expectTheme(page, 'light');
  await expect(light).toBeFocused();
});

test('switches themes even when browser storage is blocked', async ({ page }, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(Storage.prototype, method, {
        value: () => {
          throw new DOMException('Storage is blocked', 'SecurityError');
        }
      });
    }
  });
  await page.goto('/');
  await expectTheme(page, 'dark');
  await page.getByRole('button', { name: t.theme.light, exact: true }).click();
  await expectTheme(page, 'light');
  await page.getByRole('button', { name: t.theme.system }).click();
  await expectTheme(page, 'dark');
  expect(errors).toEqual([]);
});

test('shares an appearance choice across open tabs', async ({ page, context }, testInfo) => {
  const t = messages[testInfo.project.name === 'mobile-ru' ? 'ru' : 'en'];
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light' });
  await other.goto('/');
  await page.getByRole('button', { name: t.theme.dark, exact: true }).click();
  await expectTheme(other, 'dark');
  await other.getByRole('button', { name: t.theme.system }).click();
  await expectTheme(page, 'light');
  await other.close();
});

test('keeps dark service details and incidents legible without overflowing', async ({
  page
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-ru';
  const t = messages[mobile ? 'ru' : 'en'];
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const snapshot = emptySnapshot();
  const states: Status[] = ['operational', 'degraded', 'outage', 'maintenance', 'unknown'];
  snapshot.components.forEach((component, index) => {
    component.status = states[index % states.length];
    component.checkedAt = snapshot.generatedAt;
  });
  snapshot.incidents = [
    {
      id: 'theme-check',
      title: { en: 'Connection recovery', ru: 'Восстановление подключения' },
      status: 'monitoring',
      impact: 'degraded',
      startedAt: snapshot.generatedAt,
      updatedAt: snapshot.generatedAt,
      components: ['website'],
      updates: [
        {
          at: snapshot.generatedAt,
          message: {
            en: 'Connections are recovering. We are checking stability.',
            ru: 'Подключения восстанавливаются. Проверяем стабильность.'
          }
        }
      ]
    }
  ];
  await page.route('**/api/status', (route) => route.fulfill({ json: snapshot }));
  await page.getByRole('button', { name: t.refresh, exact: true }).click();
  await page.locator('.component-toggle').first().click();
  await expect(page.locator('.history-bars')).toBeVisible();
  await expect(page.locator('.incident')).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `test-results/${testInfo.project.name}-dark.png`, fullPage: true });

  // Check text contrast against the actual computed surface, including translucent cards.
  const contrast = await page.evaluate(() => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (color: number[]) =>
      color
        .slice(0, 3)
        .map((channel) => {
          const c = channel / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (element: Element | null): number[] => {
      if (!element) return [16, 22, 19];
      const color = rgb(getComputedStyle(element).backgroundColor);
      const alpha = color[3] ?? 1;
      if (alpha === 1) return color;
      const behind = background(element.parentElement);
      return color.slice(0, 3).map((c, i) => c * alpha + behind[i] * (1 - alpha));
    };
    return [
      ...document.querySelectorAll(
        'h1, .hero-description, .status-pill, .component-title, .detail-note, .history-heading, .incident-update p, .incident-state, .button, .theme-switch button.active'
      )
    ].map((element) => {
      const a = luminance(rgb(getComputedStyle(element).color));
      const b = luminance(background(element));
      return {
        text: element.textContent?.trim(),
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      };
    });
  });
  for (const sample of contrast) expect(sample.ratio, sample.text).toBeGreaterThanOrEqual(4.5);
  for (const width of mobile ? [320, 390] : [768, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      actions: document.querySelector('.header-actions')!.getBoundingClientRect().right
    }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.width);
    expect(layout.actions).toBeLessThanOrEqual(layout.width);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'dark' });
  test('renders the device theme on the server-rendered page', async ({ page }) => {
    await page.goto('/');
    await expectTheme(page, 'dark');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
