import { expect, test, type Page } from '@playwright/test';
import { SEEDED, loginThroughUi } from './helpers/auth';
import { openMenu } from './helpers/journey';

/**
 * Screen text comes from the locale files (QA v1: mixed-language pages). A key
 * missing from the loaded locale renders as the raw key, so no `ui_…` key may
 * ever reach the screen — on the public landing page or inside the app.
 */
const RAW_KEY = /\bui_[a-z0-9]+(?:_[a-z0-9]+)+\b/;

async function expectNoRawKeys(page: Page, where: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  const text = await page.locator('body').innerText();
  expect(text.match(RAW_KEY)?.[0] ?? null, `raw translation key on ${where}`).toBeNull();
}

test('the landing page shows text, not translation keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
  await expectNoRawKeys(page, 'the landing page');
});

test('an officer\'s main screens show text, not translation keys', async ({ page }) => {
  await loginThroughUi(page, SEEDED.officerNakuru);
  await expectNoRawKeys(page, 'the dashboard');
  for (const menu of ['Farmers', 'Visits']) {
    await openMenu(page, menu);
    await expectNoRawKeys(page, menu);
  }
});
