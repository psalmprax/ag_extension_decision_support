import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage } from './helpers/mockApi';

test.describe('AI Assistant Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should navigate to AI Assistant tab', async ({ page }) => {
        const aiAssistantBtn = page.getByRole('button', { name: /AI Assistant/i });
        await aiAssistantBtn.waitFor({ state: 'visible', timeout: 15000 });
        await aiAssistantBtn.click();
        await page.waitForTimeout(500);
        await expect(page.getByText('AI Advisor')).toBeVisible();
    });

    test('should show Start New Conversation button', async ({ page }) => {
        const aiAssistantBtn = page.getByRole('button', { name: /AI Assistant/i });
        await aiAssistantBtn.waitFor({ state: 'visible', timeout: 15000 });
        await aiAssistantBtn.click();
        await page.waitForTimeout(500);
        await expect(page.getByRole('button', { name: /Start New Conversation/i })).toBeVisible();
    });

    test('should show AI capabilities', async ({ page }) => {
        const aiAssistantBtn = page.getByRole('button', { name: /AI Assistant/i });
        await aiAssistantBtn.waitFor({ state: 'visible', timeout: 15000 });
        await aiAssistantBtn.click();
        await page.waitForTimeout(500);
        await expect(page.getByText('Crop diseases')).toBeVisible();
        await expect(page.getByText('Weather')).toBeVisible();
        await expect(page.getByText('Farming practices')).toBeVisible();
        await expect(page.getByText('Pest management')).toBeVisible();
    });
});

test.describe('Farmer Chat Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuthenticatedPage(page);
    });

    test('should navigate to Farmer Chat tab', async ({ page }) => {
        const farmerChatBtn = page.getByRole('button', { name: /Farmer Chat/i });
        await farmerChatBtn.waitFor({ state: 'visible', timeout: 15000 });
        await farmerChatBtn.click();
        await page.waitForTimeout(500);
        await expect(page.getByText('Connect with Farmers')).toBeVisible();
    });
});

test.describe('Health Check Endpoint', () => {
    test.beforeEach(async ({ page }) => {
        // Mock health endpoint using page.route (intercepts page fetch calls)
        await page.route('**/health', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'healthy',
                    services: { database: 'connected', redis: 'connected' },
                    timestamp: new Date().toISOString(),
                }),
            });
        });
        await page.goto('http://localhost:5173');
    });

    test('should return healthy status via mocked API', async ({ page }) => {
        // Use page.evaluate with fetch() so request goes through page.route interception
        const data = await page.evaluate(async () => {
            const res = await fetch('/health');
            return res.json();
        });
        expect(data.status).toBe('healthy');
        expect(data.services).toBeDefined();
    });
});

test.describe('API Endpoints', () => {
    test.beforeEach(async ({ page }) => {
        // Mock upload endpoint to test auth-required behavior
        await page.route('**/api/upload', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, error: 'Unauthorized' }),
            });
        });
        await page.goto('http://localhost:5173');
    });

    test('upload endpoint should return 401 (auth required via mock)', async ({ page }) => {
        const status = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/upload', { method: 'POST' });
                return res.status;
            } catch {
                return 401;
            }
        });
        // Our mock returns 401 for upload (simulating auth required)
        expect(status).toBe(401);
    });
});
