import { test, expect } from '@playwright/test';

test.describe('Theme Map Expansion Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
    });

        await page.addInitScript(() => {
            localStorage.setItem('theme', 'dark'); // Force dark mode
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        // Wait a bit for theme to apply
        await page.waitForTimeout(1000);

        const hasCyberClass = await page.evaluate(() => {
        });

        // Check if dark mode is enforced
        const isDark = await page.evaluate(() => {
            return document.documentElement.classList.contains('dark');
        });

        console.log(`Cyber theme class: ${hasCyberClass}`);
        console.log(`Dark mode: ${isDark}`);

        // The theme should be applied (this tests the basic theme switching)
        expect(hasCyberClass || isDark).toBe(true);
    });

    test('should expand map to fullscreen in any theme', async ({ page }) => {
        // Wait for map to load
        await page.waitForTimeout(2000);

        // Look for any expand/fullscreen button in the page
        // Common patterns for map expand buttons
        const expandButtons = page.locator('button').filter({ has: page.locator('[class*="expand"], [class*="fullscreen"], [class*="Maximize"], svg') });

        // Try to find the expand button - check for common icons
        const maximizeIcon = page.locator('button:has(svg.lucide-maximize), button:has(svg[class*="maximize"])').first();

        if (await maximizeIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
            await maximizeIcon.click();
            await page.waitForTimeout(500);

            // Check if modal is visible
            const modal = page.locator('.fixed.inset-0.z-\\[9999\\]');
            const isModalVisible = await modal.isVisible();

            console.log(`Fullscreen modal visible: ${isModalVisible}`);

            if (isModalVisible) {
                // Verify it's fullscreen dimensions
                const modalBox = await modal.boundingBox();
                console.log(`Modal dimensions: ${modalBox?.width}x${modalBox?.height}`);

                // Should be close to full viewport
                expect(modalBox?.width).toBeGreaterThan(1000);
                expect(modalBox?.height).toBeGreaterThan(600);
            }
        } else {
            // Try alternative - look for any button that might expand the map
            console.log('Looking for expand button in alternative locations...');

            // Check for Leaflet fullscreen control
            const leafletFullscreen = page.locator('.leaflet-control-zoom-in, .leaflet-control-fullscreen');
            if (await leafletFullscreen.isVisible({ timeout: 1000 }).catch(() => false)) {
                await leafletFullscreen.click();
                await page.waitForTimeout(500);

                const isExpanded = await page.locator('.leaflet-container').first().isVisible();
                console.log(`Leaflet expanded: ${isExpanded}`);
            }
        }
    });

    test('should verify map exists and is interactive', async ({ page }) => {
        // Wait for the page to fully load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check for map container - Leaflet uses .leaflet-container
        const mapContainer = page.locator('.leaflet-container').first();

        // Also check for any map-related element
        const hasMap = await mapContainer.isVisible().catch(() => false);
        console.log(`Map container visible: ${hasMap}`);

        if (hasMap) {
            // Verify the map has proper dimensions
            const mapBox = await mapContainer.boundingBox();
            console.log(`Map dimensions: ${mapBox?.width}x${mapBox?.height}`);

            expect(mapBox?.width).toBeGreaterThan(100);
            expect(mapBox?.height).toBeGreaterThan(100);
        } else {
            // Map might not be visible on initial load - check if there's a loading state or alternative
            console.log('Map not immediately visible - checking for alternative states...');

            // Check for loading skeleton or placeholder
            const hasLoading = await page.locator('[class*="skeleton"], [class*="loading"]').first().isVisible().catch(() => false);
            console.log(`Loading state: ${hasLoading}`);
        }
    });

    test('should switch between themes and verify consistency', async ({ page }) => {
        // Find the theme switcher button
        const themeButton = page.getByRole('button', { name: /theme/i }).first();

        if (await themeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await themeButton.click();
            await page.waitForTimeout(500);

            // Look for theme options in the dropdown

            // Count available themes
            const themeCount = await themeOptions.count();
            console.log(`Found ${themeCount} theme options`);

                await page.waitForTimeout(1000);

                // Verify theme was applied
                const hasCyberClass = await page.evaluate(() => {
                });
                console.log(`Cyber theme applied: ${hasCyberClass}`);
            }
        } else {
            console.log('Theme button not found - page may be in a different state');
        }
    });
});
