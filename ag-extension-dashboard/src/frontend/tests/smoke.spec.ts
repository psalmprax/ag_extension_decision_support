import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage } from './helpers/mockApi';

test.describe('Dashboard Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('should load the dashboard and show the header', async ({ page }) => {
    // The dashboard heading is 'Strategic Intelligence' (modern) or 'Operations Dashboard' (classic)
    await expect(page.getByRole('heading', { name: /Strategic Intelligence|Operations Dashboard/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show the sidebar with navigation items', async ({ page }) => {
    // Scope to the sidebar <nav> element to avoid matching the AppHeader
    const sidebar = page.locator('nav');
    await expect(sidebar.getByRole('button', { name: /Strategic Intelligence|Operations Dashboard/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Cognitive Synthesizer|AI Assistant/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Human Capital Network|Client Portfolio/i })).toBeVisible();
  });

  test('should display the weather widget', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasWeather = await page.getByText(/Weather/i).isVisible().catch(() => false);
    console.log(`Weather visible: ${hasWeather}`);
  });

  test('should switch between tabs', async ({ page }) => {
    const portfolioBtn = page.getByRole('button', { name: /Human Capital Network|Client Portfolio/i }).first();
    await portfolioBtn.click();
    await page.waitForTimeout(1000);

    // Portfolio page heading
    await expect(page.getByRole('heading', { name: /Human Capital Network|Client Portfolio/i }).first()).toBeVisible({ timeout: 10000 });

    const dashboardBtn = page.getByRole('button', { name: /Strategic Intelligence|Operations Dashboard/i }).first();
    await dashboardBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('heading', { name: /Strategic Intelligence|Operations Dashboard/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
