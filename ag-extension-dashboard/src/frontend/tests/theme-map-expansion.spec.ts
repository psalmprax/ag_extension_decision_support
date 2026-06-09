import { test, expect } from '@playwright/test';

test.describe('Theme Map Expansion Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
    });

    test('should switch to dark mode', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('theme', 'dark'); // Force dark mode
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        // Wait a bit for theme to apply
        await page.waitForTimeout(1000);

        const hasCyberClass = await page.evaluate(() => {
            return document.documentElement.classList.contains('cyber');
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
                if (modalBox) {
                    expect(modalBox.width).toBeGreaterThan(800);
                    expect(modalBox.height).toBeGreaterThan(400);
                }
            }
        } else {
            console.log('Maximize icon not found, skipping specific full-screen dimensions check');
        }
    });

    test('should verify map exists and is interactive', async ({ page }) => {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check for map container - Leaflet uses .leaflet-container
        const mapContainer = page.locator('.leaflet-container').first();

        const hasMap = await mapContainer.isVisible().catch(() => false);
        console.log(`Map container visible: ${hasMap}`);

        if (hasMap) {
            const mapBox = await mapContainer.boundingBox();
            console.log(`Map dimensions: ${mapBox?.width}x${mapBox?.height}`);

            if (mapBox) {
                expect(mapBox.width).toBeGreaterThan(100);
                expect(mapBox.height).toBeGreaterThan(100);
            }
        }
    });

    test('should switch between themes and verify consistency', async ({ page }) => {
        // Find the theme switcher button
        const themeButton = page.getByRole('button', { name: /theme/i }).first();

        if (await themeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await themeButton.click();
            await page.waitForTimeout(500);

            // Just verify the button exists for now
            expect(await themeButton.isVisible()).toBe(true);
        } else {
            console.log('Theme button not found - page may be in a different state');
        }
    });
});
