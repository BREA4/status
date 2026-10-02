import type { Page } from '@playwright/test';

export async function chooseLanguage(page: Page, locale: 'en' | 'ru') {
  await page.locator('#language-selector').click();
  await page
    .getByRole('menuitemradio', { name: locale === 'en' ? 'English' : 'Русский', exact: true })
    .click();
}

export async function chooseTheme(page: Page, label: string) {
  await page.locator('#theme-selector').click();
  await page.getByRole('menuitemradio', { name: label, exact: true }).click();
}
