import { test, expect, type Page } from '@playwright/test';

const DEMO_USER = {
  id: 'demo-farmer-1',
  email: 'demo@agridemo.com',
  firstName: 'Emmanuel',
  lastName: 'Mwangi',
  role: 'extension_officer',
  region: 'Machakos',
};

const AUTH_RESPONSE = {
  success: true,
  data: { token: 'e2e-demo-token', user: DEMO_USER },
  token: 'e2e-demo-token',
  user: DEMO_USER,
};

async function setupE2EMockRoutes(page: Page) {
  const isApiPath = (url: URL) => url.pathname.startsWith('/api/');

  await page.route(isApiPath, async route => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === '/api/auth/demo' || pathname === '/api/auth/login') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AUTH_RESPONSE),
      });
    }

    if (pathname === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: DEMO_USER }),
      });
    }

    if (pathname === '/api/external/weather') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { temp: 22, temperature: 22, condition: 'sunny', humidity: 40, windSpeed: 5 },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

test.describe('@e2e Critical Operational User Journey', () => {
  test.setTimeout(120_000);

  test('extension officer full lifecycle: demo login -> dashboard -> map & metrics', async ({ page }) => {
    await setupE2EMockRoutes(page);

    // 1. Visit Login Page
    await page.goto('/login');

    // 2. Click Demo Mode
    await page.getByRole('button', { name: 'Try the Demo' }).click({ timeout: 60000 });

    // 3. Verify Dashboard Navigation & Elements
    await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 30000 });

    // Verify Region Badge is displayed
    const regionBadge = page.locator('text=Kenya Overview');
    await expect(regionBadge).toBeVisible();

    // 4. Verify Map Container exists
    const mapElement = page.locator('.leaflet-container');
    await expect(mapElement).toBeVisible();
  });
});
