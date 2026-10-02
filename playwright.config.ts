import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: 'mobile-ru',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', locale: 'ru-RU' }
    }
  ],
  webServer: {
    command: 'bun run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
});
