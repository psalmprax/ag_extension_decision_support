import { chromium, type FullConfig } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5173';

/**
 * Pre-compile the app's module graph before any test runs. The Vite dev server
 * transforms modules on first request, and `domcontentloaded` waits for the
 * full eager import graph (App → TabContent → every page) to execute — which can
 * exceed a single test timeout on a cold start. We navigate with `commit`
 * (returns as soon as the response is committed) and then wait for a rendered
 * marker, so the slow transform happens once here instead of inside every spec.
 */
export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const warm = async (path: string, marker: string) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'commit', timeout: 240_000 });
    await page.waitForSelector(marker, { timeout: 240_000 });
  };

  // Landing (compiles App + TabContent + all pages) and login (its own route chunk).
  await warm('/', 'main');
  await warm('/login', 'form');

  await browser.close();
}
