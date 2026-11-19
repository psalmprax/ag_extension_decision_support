import { defineConfig, devices } from '@playwright/test';

/**
 * Real-backend E2E.
 *
 * Unlike `playwright.config.ts` (Vite only, every `/api` call mocked) and
 * `playwright.live.config.ts` (an already-deployed URL), this config starts the
 * Express backend and Vite together and points the dev proxy at the backend, so
 * specs exercise the real routes, database and auth cookies.
 *
 * Prerequisites:
 *   docker compose up -d app-db          # or any Postgres on DATABASE_URL
 *   cd ../../src/backend && npm run migrate:deploy
 *
 * The global setup resets and re-seeds the real-world fixtures before each run
 * (`npm run seed:realworld -- --reset`); E2E_SKIP_RESEED=1 skips it.
 *
 * Then, from `src/frontend`:
 *   npm run test:e2e:real
 */
const FRONTEND_URL = 'http://127.0.0.1:5173';
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3001';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:7501/ag_extension';

export default defineConfig({
  testDir: './tests-e2e',
  /* Reset and re-seed the real-world fixtures, so every run starts from the same data. */
  globalSetup: './tests-e2e/global-setup.ts',
  /* The specs share one seeded database and one backend; parallel writers would race. */
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120 * 1000,
  expect: { timeout: 30 * 1000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : undefined,
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
      env: {
        DATABASE_URL,
        // `src/index.ts` only calls bootstrap() when NODE_ENV !== 'test', and the
        // default port is 3000. Listen on 3001 here so the health gate and the
        // Vite proxy agree with the compose convention.
        PORT: '3001',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
      env: {
        // The compose default (`http://backend:3001`) does not resolve on the host.
        VITE_API_PROXY_TARGET: BACKEND_URL,
      },
    },
  ],
});
