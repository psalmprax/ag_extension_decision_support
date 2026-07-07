import { test, expect } from '@playwright/test';

test.describe('Farmer Onboarding & AI Advisor Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    // Register a new test user for the E2E flow
    const testEmail = `test_${Date.now()}@example.com`;
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    await page.selectOption('select[name="role"]', 'extension_officer');
    await page.click('button[type="submit"]');

    // Wait for redirect to login
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Log in with the new account
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should allow registering a new farmer and getting AI advice', async ({ page }) => {
    // 1. Navigate to Farmers page
    await page.click('nav a:has-text("Farmers")');
    await expect(page).toHaveURL('/farmers');

    // 2. Click Add Farmer
    await page.click('button:has-text("Add Farmer")');

    // 3. Fill Farmer Details
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Farmer');
    await page.fill('input[name="phone"]', '1234567890');
    await page.selectOption('select[name="region"]', 'Central');
    await page.click('button:has-text("Save")');

    // 4. Verify Farmer added
    await expect(page.locator('text=Test Farmer')).toBeVisible();

    // 5. Navigate to AI Advisor
    await page.click('nav a:has-text("AI Advisor")');
    await expect(page).toHaveURL('/ai-advisor');

    // 6. Ask a question
    await page.fill('textarea[placeholder*="Ask"]', 'What is the best crop for Central region?');
    await page.keyboard.press('Enter');

    // 7. Verify AI response
    const aiResponse = page.locator('.ai-message, [data-testid="ai-response"]');
    await expect(aiResponse.first()).toBeVisible({ timeout: 15000 });
  });
});
