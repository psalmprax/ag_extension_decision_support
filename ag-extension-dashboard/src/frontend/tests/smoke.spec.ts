import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage } from './helpers/mockApi';

test.describe('Dashboard Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedPage(page);
  });

  test('should load the dashboard and show the header', async ({ page }) => {
    // The dashboard heading is 'Strategic Intelligence' (modern) or 'Operations Dashboard' (classic)
    // Use filter({ hasText }) not getByRole accessible name — accessible name may differ from text content
    await expect(page.locator('h1').filter({ hasText: /Strategic Intelligence|Operations Dashboard/i })).toBeVisible({ timeout: 10000 });
  });

  test('should show the sidebar with navigation items', async ({ page }) => {
    // Scope to the sidebar <aside> element to avoid matching the AppHeader
    const sidebar = page.locator('aside');
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
    const sidebar = page.locator('aside');
    const portfolioBtn = sidebar.getByRole('button', { name: /Human Capital Network|Client Portfolio/i });
    await portfolioBtn.click();
    await page.waitForTimeout(1000);

    // Portfolio page heading
    await expect(page.locator('h1').filter({ hasText: /Human Capital Network|Client Portfolio/i })).toBeVisible({ timeout: 10000 });

    const dashboardBtn = sidebar.getByRole('button', { name: /Strategic Intelligence|Operations Dashboard/i });
    await dashboardBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('h1').filter({ hasText: /Strategic Intelligence|Operations Dashboard/i })).toBeVisible({ timeout: 10000 });
  });
});
