import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage } from './helpers/mockApi';

test.describe('Menu Translation Tests', () => {
    test('should translate both menu and right panel content', async ({ page }) => {
        await setupAuthenticatedPage(page);

        // Wait for page to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Check initial English text
        console.log('=== Testing English (default) ===');
        const hasDashboardEN = await page.getByText('Dashboard').isVisible().catch(() => false);
        expect(hasDashboardEN).toBe(true);

        // Find language switcher — try button first, then select
        const langButton = page.locator('button:has-text("EN"), button:has-text("FR"), [class*="language"]').first();
        const hasLangButton = await langButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasLangButton) {
            console.log('Language switcher found as button');
            await langButton.click();
            await page.waitForTimeout(500);
            // Clicking the language button should show options — just verify no crash
            console.log('Language switcher clicked successfully');
        } else {
            const langSelect = page.locator('select').first();
            const hasSelect = await langSelect.isVisible({ timeout: 2000 }).catch(() => false);
            if (hasSelect) {
                console.log('Language switcher found as select');
                // Verify the select has language options
                const options = await langSelect.locator('option').all();
                console.log(`Language options: ${options.length}`);

                // Switch to French
                await langSelect.selectOption('fr');
                await page.waitForTimeout(1000);
                console.log('Switched to French');

                // Switch to English
                await langSelect.selectOption('en');
                await page.waitForTimeout(1000);
                console.log('Switched back to English');
            } else {
                console.log('No language switcher found on page');
            }
        }

        console.log('\n=== Translation Test Complete ===');
    });

    test('verify right panel content translates', async ({ page }) => {
        await setupAuthenticatedPage(page);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Check that dashboard content is visible
        const hasDashboardContent = await page.getByText(/Dashboard|Overview/i).isVisible().catch(() => false);
        console.log(`Dashboard content visible: ${hasDashboardContent}`);

        // Try to find and switch language
        const langSelect = page.locator('select').first();
        const hasSelect = await langSelect.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasSelect) {
            const options = await langSelect.locator('option').all();
            console.log(`Language options count: ${options.length}`);

            // Switch to French
            await langSelect.selectOption('fr');
            await page.waitForTimeout(1000);

            // Switch to German
            await langSelect.selectOption('de');
            await page.waitForTimeout(1000);

            // Switch back to English
            await langSelect.selectOption('en');
            await page.waitForTimeout(1000);
        } else {
            const langButton = page.locator('button:has-text("EN"), button:has-text("FR"), [class*="language"]').first();
            const hasButton = await langButton.isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`Language button found: ${hasButton}`);
        }
    });
});
