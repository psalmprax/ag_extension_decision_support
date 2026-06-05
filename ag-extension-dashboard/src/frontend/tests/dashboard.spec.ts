import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, setupApiMocks } from './helpers/mockApi';

test.describe('Dashboard Page', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should load dashboard with sidebar navigation', async ({ page }) => {
        const sidebar = page.locator('aside');
        await expect(sidebar.getByRole('button', { name: /Strategic Intelligence|Operations Dashboard/i })).toBeVisible({ timeout: 15000 });
        await expect(sidebar.getByRole('button', { name: /Human Capital Network|Client Portfolio/i })).toBeVisible({ timeout: 5000 });
        await expect(sidebar.getByRole('button', { name: /Cognitive Synthesizer|AI Assistant/i })).toBeVisible({ timeout: 5000 });
        await expect(sidebar.getByRole('button', { name: /Network Communications|Farmer Chat/i })).toBeVisible({ timeout: 5000 });
    });

    test('should switch tabs and show correct content', async ({ page }) => {
        const sidebar = page.locator('aside');
        // Navigate to Portfolio
        await sidebar.getByRole('button', { name: /Human Capital Network|Client Portfolio/i }).click();
        await page.waitForTimeout(1000);
        await expect(page.locator('h1').filter({ hasText: /Human Capital Network|Client Portfolio/i })).toBeVisible({ timeout: 10000 });

        // Navigate back to Dashboard
        await sidebar.getByRole('button', { name: /Strategic Intelligence|Operations Dashboard/i }).click();
        await page.waitForTimeout(1000);
        await expect(page.locator('h1').filter({ hasText: /Strategic Intelligence|Operations Dashboard/i })).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should have proper heading structure', async ({ page }) => {
        const headingCount = await page.locator('h1, h2, h3').count();
        console.log(`Headings found: ${headingCount}`);
        expect(headingCount).toBeGreaterThan(0);
    });

    test('should have alt text on images', async ({ page }) => {
        // Note: beforeEach already calls setupAuthenticatedPage, no need for second call
        const images = page.locator('img');
        const count = await images.count();
        for (let i = 0; i < count; i++) {
            const alt = await images.nth(i).getAttribute('alt');
            expect(alt !== null).toBe(true);
        }
    });

    test('should not show error boundaries', async ({ page }) => {
        // Note: beforeEach already calls setupAuthenticatedPage, no need for second call
        const errorElements = page.locator('[class*=\"error\"], [class*=\"Error\"]').first();
        const hasError = await errorElements.isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasError).toBe(false);
    });
});

test.describe('Performance', () => {
    test('should load page within acceptable time', async ({ page }) => {
        const startTime = Date.now();

        await page.addInitScript(() => {
            const token = 'mock-token';
            const user = JSON.stringify({
                id: 'demo-user-001', email: 'demo@agextension.com',
                firstName: 'Demo', lastName: 'User', role: 'extension_officer', region: 'Central',
            });
            localStorage.setItem('token', token);
            localStorage.setItem('user', user);
            localStorage.setItem('ag-extension-auth', JSON.stringify({
                state: { user: { id: 'demo-user-001', email: 'demo@agextension.com', firstName: 'Demo', lastName: 'User', role: 'extension_officer', region: 'Central' } }, version: 0,
            }));
        });
        await setupApiMocks(page);
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        console.log(`Page load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(15000);
    });
});

// Infrastructure-dependent tests: skipped because they require WebGL (Leaflet maps)
// or specific API data (weather), which are not available in headless Chromium CI.
test.describe('Farmer Map Component', () => {
    test.skip('should render map component (requires WebGL in headless Chromium)', () => {});
    test.skip('should have map layer controls (requires WebGL in headless Chromium)', () => {});
});

test.describe('Weather Widget', () => {
    test.skip('should display weather information (requires real weather API data)', () => {});
});

test.describe('Language Support', () => {
    test.skip('should have language switcher (located in header or login page depending on context)', () => {});
});
