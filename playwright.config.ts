import { defineConfig } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: APP_URL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Minsk',
    viewport: { width: 360, height: 800 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // The suite runs against the production bundle, the one that ends up in the APK: the dev server
  // ships sources, its own error overlay and the Vue DevTools panel, none of which reach a user.
  webServer: {
    command: 'npm run build-only && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
