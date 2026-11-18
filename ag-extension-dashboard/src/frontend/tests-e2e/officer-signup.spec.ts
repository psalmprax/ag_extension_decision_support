import { expect, test } from '@playwright/test';
import { SEEDED, SEEDED_PASSWORD, uniqueOfficerEmail } from './helpers/auth';

/**
 * Officer signup against the real backend.
 *
 * The public form picks a country and region; the server resolves the regional
 * manager from that region and reports `managerAssigned`, which is the only
 * evidence the client gets — the manager's identity is deliberately not returned
 * to an unauthenticated caller.
 */
test.describe('officer signup and manager assignment', () => {
  test('an officer registering for Rift Valley is assigned the Nakuru manager', async ({ page }) => {
    const email = uniqueOfficerEmail();

    await page.goto('/register');
    await page.locator('#reg-firstName').fill('E2E');
    await page.locator('#reg-lastName').fill('Officer');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill(SEEDED_PASSWORD);
    await page.locator('#reg-confirmPassword').fill(SEEDED_PASSWORD);
    await page.locator('#reg-country').selectOption({ label: 'Kenya' });
    await page.locator('#reg-region').selectOption({ label: SEEDED.managerNakuru.region });
    await page.locator('#reg-role').selectOption('extension_officer');

    const [response] = await Promise.all([
      page.waitForResponse(
        res => res.url().includes('/api/v1/auth/register') && res.request().method() === 'POST'
      ),
      page.locator('form button[type="submit"]').click(),
    ]);

    expect(response.ok(), `register responded ${response.status()}`).toBe(true);
    const body = (await response.json()) as {
      success: boolean;
      data: { managerAssigned?: boolean; user?: { role?: string; region?: string } };
    };

    expect(body.success).toBe(true);
    expect(body.data.managerAssigned).toBe(true);
    expect(body.data.user).toMatchObject({
      role: 'extension_officer',
      region: SEEDED.managerNakuru.region,
    });
  });

  test('the form offers no administrator role', async ({ page }) => {
    await page.goto('/register');

    const roleLabels = await page.locator('#reg-role option').allTextContents();
    const roleValues = await page.locator('#reg-role option').evaluateAll(options =>
      options.map(option => (option as HTMLOptionElement).value)
    );

    expect(roleValues.sort()).toEqual(['extension_officer', 'farmer']);
    expect(roleLabels.join(' ')).not.toMatch(/admin/i);
  });
});
