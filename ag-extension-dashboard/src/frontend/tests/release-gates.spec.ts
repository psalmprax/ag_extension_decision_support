import { test, expect } from '@playwright/test';

test.describe('@release public accessibility gates', () => {
  test('landing page exposes landmarks, named actions, and image alternatives', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    const images = page.locator('img');
    for (let index = 0; index < await images.count(); index += 1) {
      await expect(images.nth(index)).toHaveAttribute('alt');
    }
  });

  test('login controls are labelled and keyboard reachable', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const email = page.getByLabel(/email/i);
    const password = page.getByLabel(/password/i);
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
  });
});
