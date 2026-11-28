import { test, expect, type Page } from '@playwright/test';

const DEMO_USER = {
  id: 'demo-farmer-1',
  email: 'demo@agridemo.io',
  firstName: 'Emmanuel',
  lastName: 'Mwangi',
  role: 'extension_officer',
  region: 'Machakos',
  isDemo: true,
};

const AUTH_RESPONSE = {
  success: true,
  data: { token: 'e2e-demo-token', user: DEMO_USER },
  token: 'e2e-demo-token',
  user: DEMO_USER,
};

async function mockDemoBackend(page: Page) {
  const isApiPath = (url: URL) => url.pathname.startsWith('/api/');

  await page.route(isApiPath, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
  await page.route(url => url.pathname === '/api/auth/demo', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AUTH_RESPONSE),
    });
  });
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: DEMO_USER }),
    });
  });
  await page.route(url => url.pathname === '/api/external/weather', async route => {
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

test.describe('@e2e Critical Operational User Journey', () => {
  test.setTimeout(180_000);

  test('extension officer full lifecycle: demo login -> dashboard metrics -> field verification', async ({
    page,
  }) => {
    await mockDemoBackend(page);
    await page.goto('/login');

    await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 90000 });
    await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({
      timeout: 30000,
    });

    // 1. Positive control: Verify the assigned demo officer and farmer are rendered
    await expect(page.getByText('Emmanuel Mwangi').first()).toBeVisible({ timeout: 15000 });

    // 2. Crops & fields is not part of the demo: the locked card says how to ask for access.
    await page.goto('/fields');
    await expect(page.getByText('Not included in your account yet').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('link', { name: 'Ask us for access' })).toHaveAttribute('href', /^mailto:info@gpfed\.com/);
  });

  test('mobile viewport provides accessible bottom navigation bar for field officers', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockDemoBackend(page);
    await page.goto('/login');

    await page.getByRole('button', { name: 'Try the demo' }).click({ timeout: 90000 });

    // Assert Mobile Bottom Navigation Bar is visible on mobile screens
    const bottomNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(bottomNav).toBeVisible({ timeout: 30000 });

    // Verify key action items exist inside mobile bottom bar
    await expect(bottomNav.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Farmers' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'AI scan' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Knowledge' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Menu' })).toBeVisible();
  });
});
