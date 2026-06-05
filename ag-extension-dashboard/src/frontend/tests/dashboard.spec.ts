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

// Infrastructure-dependent tests: these may use WebGL (Leaflet maps) or external tile services
// but the component containers render even without full WebGL support.
test.describe('Farmer Map Component', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should render farmer map container on dashboard', async ({ page }) => {
        // The FarmerMap component renders .leaflet-container even in headless mode
        const mapContainer = page.locator('.leaflet-container');
        await expect(mapContainer).toBeVisible({ timeout: 15000 });
    });

    test('should have map interaction elements (zoom controls)', async ({ page }) => {
        // Zoom controls are part of the Leaflet UI
        const zoomIn = page.locator('.leaflet-control-zoom-in');
        await expect(zoomIn).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Weather Widget', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should display weather information from mocked API', async ({ page }) => {
        // WeatherWidget fetches /api/external/weather and displays temp + condition
        // The API_MOCKS table has /api/external/weather returning mock data
        await page.waitForTimeout(3000);
        const weatherVisible = await page.getByText(/Sunny|Clear|Rain|Cloud|°C/i).first().isVisible().catch(() => false);
        expect(weatherVisible).toBe(true);
    });
});

test.describe('Language Support', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should have language switcher in the app header', async ({ page }) => {
        // LanguageSwitcher component is rendered in AppHeader
        // It shows a globe/language icon button that opens a dropdown
        const langSwitcher = page.locator('header').getByRole('button').filter({ hasText: /language|EN|SW|ES|FR/i });
        const hasLangSwitcher = await langSwitcher.count().then(c => c > 0).catch(() => false);
        // The language switcher may use an icon without text — check for any language-related element in the header
        const hasLangElement = await page.locator('[aria-label*="language" i], [aria-label*="Language" i], [data-testid*="language" i]').count().then(c => c > 0).catch(() => false);
        console.log(`Language switcher found: ${hasLangSwitcher || hasLangElement}`);
        // At minimum, the page should have some language-related UI
        expect(hasLangSwitcher || hasLangElement).toBe(true);
    });
});
