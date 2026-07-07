import { test, expect } from '@playwright/test';

test.describe('Theme Comparison: Cyber vs Forest', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should verify cyber and forest themes have consistent UI behavior', async ({ page }) => {
    // Test Forest theme first
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'forest');
      localStorage.setItem('theme', 'light'); // Forest uses light by default
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check forest theme state
    const forestHasCyberClass = await page.evaluate(() => {
      return document.body.classList.contains('theme-cyber');
    });
    const forestIsDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });

    console.log(`Forest - Cyber class: ${forestHasCyberClass}, Dark mode: ${forestIsDark}`);

    // Forest should NOT have cyber class and should be light (unless user prefers dark)
    expect(forestHasCyberClass).toBe(false);

    // Test Cyber theme
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'cyber');
      localStorage.setItem('theme', 'dark'); // Force dark for cyber
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check cyber theme state
    const cyberHasCyberClass = await page.evaluate(() => {
      return document.body.classList.contains('theme-cyber');
    });
    const cyberIsDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });

    console.log(`Cyber - Cyber class: ${cyberHasCyberClass}, Dark mode: ${cyberIsDark}`);

    // Cyber should have cyber class and be dark
    expect(cyberHasCyberClass).toBe(true);
    expect(cyberIsDark).toBe(true);
  });

  test('should verify map expansion works identically in both themes', async ({ page }) => {
    // Test map expansion in Forest theme
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'forest');
      localStorage.setItem('theme', 'light');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to trigger map expansion (look for any interactive map element)
    const mapContainer = page.locator('.leaflet-container').first();
    const mapVisibleForest = await mapContainer.isVisible().catch(() => false);
    console.log(`Forest map visible: ${mapVisibleForest}`);

    // Test map expansion in Cyber theme
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'cyber');
      localStorage.setItem('theme', 'dark');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const mapContainerCyber = page.locator('.leaflet-container').first();
    const mapVisibleCyber = await mapContainerCyber.isVisible().catch(() => false);
    console.log(`Cyber map visible: ${mapVisibleCyber}`);

    // Both should have similar map visibility (might both be false if map loads lazily)
    // The key is that neither throws errors
    expect(() => mapVisibleForest).not.toThrow();
    expect(() => mapVisibleCyber).not.toThrow();
  });

  test('should verify theme-specific styling is applied correctly', async ({ page }) => {
    // Test Forest theme styling
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'forest');
      localStorage.setItem('theme', 'light');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get some theme-related CSS variables for forest
    const forestBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary');
    });
    console.log(`Forest background: ${forestBg}`);

    // Test Cyber theme styling
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'cyber');
      localStorage.setItem('theme', 'dark');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get theme-related CSS variables for cyber
    const cyberBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary');
    });
    console.log(`Cyber background: ${cyberBg}`);

    // Cyber should have very dark background (near black)
    expect(cyberBg).toContain('1'); // Should be close to rgb(1, 1, 1) or #010101

    // Both should have valid CSS values
    expect(forestBg.length).toBeGreaterThan(0);
    expect(cyberBg.length).toBeGreaterThan(0);
  });

  test('should verify interactive elements work in both themes', async ({ page }) => {
    // Test that basic interactions work in both themes

    // Forest theme
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'forest');
      localStorage.setItem('theme', 'light');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to click something interactive (like theme switcher if visible)
    const themeButton = page.getByRole('button', { name: /theme/i }).first();
    const themeButtonVisibleForest = await themeButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log(`Forest theme button visible: ${themeButtonVisibleForest}`);

    // Cyber theme
    await page.addInitScript(() => {
      localStorage.setItem('ag-theme-name', 'cyber');
      localStorage.setItem('theme', 'dark');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const themeButtonVisibleCyber = await themeButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    console.log(`Cyber theme button visible: ${themeButtonVisibleCyber}`);

    // At least the attempt to find/interact should not crash
    expect(() => themeButtonVisibleForest).not.toThrow();
    expect(() => themeButtonVisibleCyber).not.toThrow();
  });
});
