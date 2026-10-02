import { expect, test, type Page } from '@playwright/test';
import { chooseLanguage } from './preferences';

async function expectSidebarBoundary(page: Page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const incidents = document.querySelector('#incidents')!;
    window.scrollTo(0, incidents.getBoundingClientRect().top + window.scrollY - 300);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
  await expect(async () => {
    const bounds = await page.evaluate(() => ({
      sidebarBottom: document.querySelector('.services-aside')!.getBoundingClientRect().bottom,
      incidentsTop: document.querySelector('#incidents')!.getBoundingClientRect().top
    }));
    expect(
      bounds.sidebarBottom,
      'Sidebar must stop before the incident section'
    ).toBeLessThanOrEqual(bounds.incidentsTop);
  }).toPass({ timeout: 1500 });
}

for (const locale of ['en', 'ru'] as const) {
  for (const width of [1100, 1440]) {
    test(`network sidebar stays above incident history: ${locale} at ${width}px`, async ({
      page
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Desktop pinning is disabled on mobile.');
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('.service-group').first()).toHaveAttribute(
        'style',
        /translate\(0px, 0px\)/
      );
      await chooseLanguage(page, locale);
      await expectSidebarBoundary(page);

      await page
        .getByRole('button', { name: locale === 'en' ? 'Expand all' : 'Раскрыть все' })
        .click();
      await expectSidebarBoundary(page);
      await page
        .getByRole('button', { name: locale === 'en' ? 'Collapse all' : 'Свернуть все' })
        .click();
      await expectSidebarBoundary(page);
      await page
        .getByRole('button', { name: locale === 'en' ? 'Network' : 'Сеть', exact: true })
        .click();
      await expectSidebarBoundary(page);
    });
  }
}
