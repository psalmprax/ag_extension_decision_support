import { expect, test } from '@playwright/test';
import { SEEDED, SEEDED_PASSWORD, uniqueOfficerEmail } from './helpers/auth';

/**
 * An officer may sign up for a region nobody manages yet. The account is still
 * created, but the response reports `managerAssigned: false`, which is the only
 * signal the client gets that an administrator must link the account later.
 *
 * The real-world seed only creates managers for Rift Valley (Kenya) and
 * Northern Region (Malawi), so Kenya's Coast region has no manager.
 */
test.describe('officer signup without a regional manager', () => {
  test('creates the account and reports that no manager covers the region', async ({ page }) => {
    const email = uniqueOfficerEmail();

    await page.goto('/register');
    await page.locator('#reg-firstName').fill('E2E');
    await page.locator('#reg-lastName').fill('Unassigned');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill(SEEDED_PASSWORD);
    await page.locator('#reg-confirmPassword').fill(SEEDED_PASSWORD);
    await page.locator('#reg-country').selectOption({ label: 'Kenya' });
    await page.locator('#reg-region').selectOption({ label: 'Coast' });
    await page.locator('#reg-role').selectOption('extension_officer');

    const [response] = await Promise.all([
      page.waitForResponse(
        res => res.url().includes('/auth/register') && res.request().method() === 'POST'
      ),
      page.locator('form button[type="submit"]').click(),
    ]);

    expect(response.ok(), `register responded ${response.status()}`).toBe(true);
    const body = (await response.json()) as {
      success: boolean;
      data: { managerAssigned?: boolean; user?: { region?: string } };
    };

    expect(body.success).toBe(true);
    expect(body.data.managerAssigned).toBe(false);
    expect(body.data.user?.region).toBe('Coast');
  });

  test('the Mzuzu manager cannot see the Coast officer in their directory', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill(SEEDED.managerMzuzu.email);
    await page.locator('#login-password').fill(SEEDED_PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });

    const res = await page.request.get('/api/v1/users?limit=200');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: Array<{ region: string | null }> };
    for (const user of body.data) {
      expect(user.region).toBe(SEEDED.managerMzuzu.region);
    }
  });
});
