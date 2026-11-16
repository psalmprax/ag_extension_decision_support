import { defineConfig, devices } from '@playwright/test';

/**
 * Audits against a deployed environment (no local dev server). Used by the
 * "UI menu audit" workflow; never part of the regular e2e run.
 */
export default defineConfig({
  testDir: './tests-live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30 * 60 * 1000,
  use: {
    baseURL: process.env.AUDIT_BASE_URL,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: false,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
