import { test, expect } from '@playwright/test';

test.describe('AI Assistant Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should navigate to AI Assistant tab', async ({ page }) => {
    const aiAssistantBtn = page.getByRole('button', { name: /AI Assistant/i });
    await aiAssistantBtn.click();
    await expect(page.getByText('AI Advisor')).toBeVisible();
  });

  test('should show Start New Conversation button', async ({ page }) => {
    const aiAssistantBtn = page.getByRole('button', { name: /AI Assistant/i });
    await aiAssistantBtn.click();
    await expect(page.getByRole('button', { name: /Start New Conversation/i })).toBeVisible();
  });

  test('should show AI capabilities', async ({ page }) => {
    const aiAssistantBtn = page.getByRole('button', { name: /AI Assistant/i });
    await aiAssistantBtn.click();
    await expect(page.getByText('Crop diseases')).toBeVisible();
    await expect(page.getByText('Weather')).toBeVisible();
    await expect(page.getByText('Farming practices')).toBeVisible();
    await expect(page.getByText('Pest management')).toBeVisible();
  });
});

test.describe('Farmer Chat Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should navigate to Farmer Chat tab', async ({ page }) => {
    const farmerChatBtn = page.getByRole('button', { name: /Farmer Chat/i });
    await farmerChatBtn.click();
    await expect(page.getByText('Connect with Farmers')).toBeVisible();
  });
});

test.describe('Health Check Endpoint', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBeDefined();
    expect(data.services).toBeDefined();
  });
});

test.describe('API Endpoints', () => {
  test('should return 401 without auth', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/farmers');
    expect(response.status()).toBe(401);
  });

  test('should have upload endpoint', async ({ request }) => {
    // The upload endpoint should exist (will return 401 without auth)
    const response = await request.post('http://localhost:3000/api/upload');
    expect([401, 400]).toContain(response.status());
  });
});
