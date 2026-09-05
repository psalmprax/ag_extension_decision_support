import { test, expect, type Page } from '@playwright/test';
import { containsDemoId } from '../src/demo/demoIds';

/**
 * Demo-session e2e guarantee: once a user is in demo mode, synthetic demo ids
 * (demo-farmer-1, field-demo-1, …) must never appear in an outbound request.
 *
 * The Vite dev server has no backend, so the demo login + profile endpoints
 * are mocked and every other /api call is fulfilled with a benign envelope so
 * background pollers don't error-loop. The assertion checks the actual network
 * traffic: any URL carrying a demo id would have been observed here.
 */
const DEMO_USER = {
  id: 'demo-farmer-1',
  email: 'demo@agridemo.io',
  firstName: 'Emmanuel',
  lastName: 'Mwangi',
  role: 'extension_officer',
  region: 'Machakos',
};

const AUTH_RESPONSE = {
  success: true,
  data: { token: 'e2e-demo-token', user: DEMO_USER },
  // Legacy flat fields — the login handler accepts both shapes.
  token: 'e2e-demo-token',
  user: DEMO_USER,
};

/**
 * Record every /api request and fulfill it so the app never hits a real backend.
 *
 * Predicate-based routing is essential: a glob like `**\/api\/**` would also
 * match Vite source-module URLs (e.g. /src/api/notificationService.ts) and
 * fulfilling those with JSON breaks the app. Anchoring on the pathname keeps
 * interception strictly on real API calls.
 */
async function mockDemoBackend(page: Page, record: (url: string) => void) {
  const isApiPath = (url: URL) => url.pathname.startsWith('/api/');

  // Catch-all — registered first, so the specific mocks below take precedence.
  await page.route(isApiPath, async route => {
    record(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
  await page.route(url => url.pathname === '/api/auth/demo', async route => {
    record(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AUTH_RESPONSE),
    });
  });
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    record(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: DEMO_USER }),
    });
  });
  // WeatherWidget reads `condition.toLowerCase()` without a null guard — the
  // generic catch-all payload would crash the whole app, so serve a full shape.
  await page.route(url => url.pathname === '/api/external/weather', async route => {
    record(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { temp: 22, temperature: 22, condition: 'sunny', humidity: 40, windSpeed: 5 },
      }),
    });
  });
}

async function loginAsDemo(page: Page) {
  await page.goto('/login');
  // First-run Vite cold compile of this large app can take a while.
  await page.getByRole('button', { name: 'Try the Demo' }).click({ timeout: 90000 });
  // The main shell (sidebar) renders once the mocked profile resolves.
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({
    timeout: 30000,
  });
}

test.describe('Demo mode network isolation', () => {
  test.setTimeout(180_000);

  test('demo login renders demo data and never sends demo-id requests to the network', async ({
    page,
  }) => {
    const requests: string[] = [];
    await mockDemoBackend(page, url => requests.push(url));
    await loginAsDemo(page);

    // Positive control #1 — the dashboard is driven by demo data, not the API:
    // the first demo farmer is rendered client-side.
    await expect(page.getByText('Emmanuel Mwangi').first()).toBeVisible({ timeout: 15000 });

    // Positive control #2 — Crops & Fields (the original leak site) renders the
    // static demo field for the selected demo farmer.
    await page.goto('/fields');
    await expect(page.getByText('Machakos Maize Sector A').first()).toBeVisible({
      timeout: 15000,
    });

    // Let background pollers (unread-count, push subscription, socket retries) settle.
    await page.waitForTimeout(1500);

    // The guarantee: no request carrying a demo id ever reached the network.
    const demoIdRequests = requests.filter(url => containsDemoId(url));
    expect(demoIdRequests, `demo-id requests hit the network: ${JSON.stringify(demoIdRequests)}`).toEqual([]);
  });

  test('demo mode allows querying Knowledge Base benchmark scenarios without error', async ({
    page,
  }) => {
    const requests: string[] = [];
    await mockDemoBackend(page, url => requests.push(url));
    await loginAsDemo(page);

    // Navigate to Knowledge Base
    await page.goto('/knowledge');
    await expect(page.getByText('Agro-Spatial Knowledge Mesh').first()).toBeVisible({ timeout: 15000 });

    // Verify benchmark research scenario is clickable and executes
    const scenarioCard = page.getByText('Severe Soil Acidity (pH 4.8) & Liming Protocol').first();
    await expect(scenarioCard).toBeVisible({ timeout: 10000 });
    await scenarioCard.click();

    // Verify grounded synthesis renders
    await expect(page.getByText('Grounded Synthesis Completed').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('ALFA Spatial Reasoning').first()).toBeVisible({ timeout: 15000 });

    // Verify no demo id requests leaked to the network
    const demoIdRequests = requests.filter(url => containsDemoId(url));
    expect(demoIdRequests).toEqual([]);
  });
});
