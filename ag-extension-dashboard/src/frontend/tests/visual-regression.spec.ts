import { test, expect } from '@playwright/test';

test.describe('@release multi-viewport layout & visual stability gates', () => {
  const viewports = [
    { name: 'Compact Mobile (320px)', width: 320, height: 568 },
    { name: 'Standard Mobile (375px)', width: 375, height: 667 },
    { name: 'Tablet (768px)', width: 768, height: 1024 },
    { name: 'Desktop (1440px)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`landing page renders without horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Verify main container is visible
      await expect(page.locator('main')).toBeVisible();

      // Ensure no horizontal scrollbar overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px rounding tolerance
    });

    test(`login view layout is stable on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
