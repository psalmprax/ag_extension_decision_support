import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:5173');
  });

  test('should load the dashboard and show the header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ag-Extension' })).toBeVisible();
    await expect(page.getByText('Decision Support')).toBeVisible();
  });

  test('should show the sidebar with navigation items', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI Assistant' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portfolio' })).toBeVisible();
  });

  test('should display the weather widget', async ({ page }) => {
    // Ensuring the weather widget or its skeleton is present
    await expect(page.locator('header').getByText('Weather')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    const portfolioBtn = page.getByRole('button', { name: 'Portfolio' });
    await portfolioBtn.click();

    // Check for Portfolio title
    await expect(page.getByRole('heading', { name: 'Farmer Portfolio' })).toBeVisible();

    const dashboardBtn = page.getByRole('button', { name: 'Dashboard' });
    await dashboardBtn.click();
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();
  });
});
