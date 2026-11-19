import { defineConfig, devices } from '@playwright/test';

/**
 * The real-backend user stories (tests-e2e) against a deployed site: no local
 * servers and no global setup. The workflow user-stories-live.yml seeds the
 * real-world fixtures on that site first (`seed:realworld --reset`), creates
 * the temporary test system administrator, and disables it afterwards.
 *
 *   E2E_BASE_URL=https://www.gpexts.com E2E_SYSTEM_ADMIN_PASSWORD=… \
 *     npx playwright test -c playwright.live-e2e.config.ts
 */
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('E2E_BASE_URL (the deployed site) is required');

export default defineConfig({
  testDir: './tests-e2e',
  // The stories share one seeded population on a live database: run them in order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 180 * 1000,
  expect: { timeout: 45 * 1000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 60 * 1000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
