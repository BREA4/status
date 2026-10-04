import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  outputDir: 'test-results/flags',
  testMatch: 'flags-disabled.spec.ts',
  testIgnore: [],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4174', storageState: undefined },
  webServer: {
    command:
      'bun --preload ./e2e/flags-provider.ts ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: false
  }
});
