import { expect, test } from '@playwright/test';
import { messages } from '../src/lib/i18n';

test.use({ reducedMotion: 'reduce' });

test('language menu supports keyboard selection and closes without trapping focus', async ({
  page
}) => {
  await page.goto('/');
  const trigger = page.locator('#language-selector');
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: 'Русский', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(trigger).toHaveText('RU');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  await expect(page.getByRole('menuitemradio', { name: 'Русский', exact: true })).toBeChecked();
  await page.keyboard.press('e');
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

  await trigger.click();
  await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await trigger.click();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).not.toBeFocused();
});

test('opens one menu at a time and fits both themes on narrow screens', async ({
  page
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-ru';
  const t = messages[mobile ? 'ru' : 'en'];
  await page.goto('/');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of mobile ? [320, 390] : [768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#theme-selector').click();
      await expect(page.getByRole('menu')).toHaveCount(1);
      await expect(
        page.getByRole('menuitemradio', { name: t.theme.system, exact: true })
      ).toBeChecked();
      const theme = await page.getByRole('menu').boundingBox();
      expect(theme!.x).toBeGreaterThanOrEqual(0);
      expect(theme!.x + theme!.width).toBeLessThanOrEqual(width);
      await expect(page.getByRole('menuitemradio').first()).toBeInViewport();
      if (width === (mobile ? 390 : 1440))
        await page.screenshot({
          path: `test-results/${testInfo.project.name}-${colorScheme}-theme-menu.png`
        });

      await page.locator('#language-selector').click();
      await expect(page.locator('#theme-selector')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('menu')).toHaveCount(1);
      const language = await page.getByRole('menu').boundingBox();
      expect(language!.x).toBeGreaterThanOrEqual(0);
      expect(language!.x + language!.width).toBeLessThanOrEqual(width);
      if (width === (mobile ? 390 : 1440))
        await page.screenshot({
          path: `test-results/${testInfo.project.name}-${colorScheme}-language-menu.png`
        });
      await page.getByRole('heading', { level: 1 }).click();
      await expect(page.getByRole('menu')).toHaveCount(0);
    }
  }
});
