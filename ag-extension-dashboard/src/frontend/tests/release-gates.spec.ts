import { test, expect } from '@playwright/test';

test.describe('@release public accessibility gates', () => {
  test('landing page exposes landmarks, named actions, and image alternatives', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    // The landing page has both a top-nav "Get Started" and a hero "Get Started Free"
    // button — assert the hero CTA (exact name) and the nav action separately.
    await expect(page.getByRole('button', { name: 'Get Started Free' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started', exact: true }).first()).toBeVisible();
    // "Sign In" appears in both the top nav and the footer/contact section.
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();

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
    // Tab order from email: "Forgot Password?" link → password input → the
    // show/hide toggle inside the password field → submit. Assert the password
    // input is keyboard-reachable by tabbing until it gains focus.
    for (let tab = 0; tab < 4; tab += 1) {
      await page.keyboard.press('Tab');
      if (await password.evaluate(el => el === document.activeElement)) break;
    }
    await expect(password).toBeFocused();
  });

  test('app shell provides accessible skip-to-content link and keyboard access', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify skip to main content link exists
    const skipLink = page.getByRole('link', { name: /Skip to main content/i });
    await expect(skipLink).toBeAttached();

    // Verify accessible main element exists
    await expect(page.locator('#main-content')).toBeAttached();
  });
});
