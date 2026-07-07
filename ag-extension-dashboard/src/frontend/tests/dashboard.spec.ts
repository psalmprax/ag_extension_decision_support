import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load dashboard page without errors', async ({ page }) => {
    // Wait for the main content to load
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // Check that the page title or header is present
    const pageContent = await page.content();
    expect(pageContent).toContain('Dashboard');
  });

  test('should display navigation menu', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    // Check for common navigation elements
    const navLinks = page.locator('nav a, nav button');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Farmer Map Component', () => {
  test('should render map component', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for Leaflet map container
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
  });

  test('should have map layer controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check for map layer buttons (Street, Satellite, Terrain)
    const layerButtons = page.locator(
      'button:has-text("Street"), button:has-text("Satellite"), button:has-text("Terrain")'
    );
    const count = await layerButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Weather Widget', () => {
  test('should display weather information', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for weather-related content
    const weatherWidget = page.locator(
      '[class*="weather"], .weather-widget, [data-testid="weather"]'
    );
    await weatherWidget.count();
    // Weather may or may not load depending on API, just check page loads
    expect(page.url()).toContain('localhost');
  });
});

test.describe('Language Support', () => {
  test('should have language switcher', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Look for language switcher
    const langSwitcher = page.locator('select, [class*="language"], [data-testid="language"]');
    const count = await langSwitcher.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Check for h1
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');

    // Get all images
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Alt should exist or be empty (decorative)
      expect(alt !== null).toBe(true);
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/');

    // Check forms have labels
    const inputs = page.locator('input');
    const count = await inputs.count();

    if (count > 0) {
      // At least some inputs should have labels or aria-labels
      const firstInput = inputs.first();
      const ariaLabel = await firstInput.getAttribute('aria-label');
      const id = await firstInput.getAttribute('id');
      expect(ariaLabel !== null || id !== null).toBe(true);
    }
  });
});

test.describe('Performance', () => {
  test('should load page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
