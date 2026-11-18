import { test, expect, type Page } from '@playwright/test';

/**
 * Officer flows reported broken in production and fixed since: the dashboard
 * greeting rendered a raw "{name}", the activity stream's "Chat View" button
 * did nothing, and farmer, officer and AI messages looked identical. Each test
 * asserts what the officer sees, not implementation details.
 */

const OFFICER = {
  id: 'demo-officer-1',
  email: 'officer@agridemo.io',
  firstName: 'Amina',
  lastName: 'Otieno',
  role: 'extension_officer',
  region: 'Machakos',
  // Farmer chat is a Pro feature (PlanUpgradeGuard); a free officer sees the upgrade page.
  planName: 'Pro',
  isFree: false,
  isDemo: true,
};

async function signInAsDemoOfficer(page: Page) {
  // Anything not routed below fails like an unavailable backend endpoint (404),
  // so no request reaches a real backend and every widget takes its error path.
  await page.route(url => url.pathname.startsWith('/api/'), route =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Not available in this test' }) }),
  );
  await page.route(url => url.pathname === '/api/auth/demo', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { token: 'e2e-token', user: OFFICER }, token: 'e2e-token', user: OFFICER }),
    }),
  );
  // The demo farmer chat asks the public demo endpoint for the AI reply.
  await page.route(url => url.pathname.endsWith('/chatbot/public-demo'), route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { text: 'Fixture reply: record the damage per plant before treating.' } }),
    }),
  );
  await page.route(url => url.pathname === '/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: OFFICER }) }),
  );

  await page.goto('/login');
  await page.getByRole('button', { name: 'Try the Demo' }).click({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('@e2e Officer dashboard and farmer chat', () => {
  test.setTimeout(180_000);

  test('greets the officer by first name, never with a raw placeholder', async ({ page }) => {
    await signInAsDemoOfficer(page);

    await expect(page.getByText('Welcome back, Amina! Here is your overview.')).toBeVisible();
    await expect(page.getByText('{name}')).toHaveCount(0);
  });

  test('Chat View opens that farmer\'s conversation, with farmer, officer and AI messages labelled apart', async ({ page }) => {
    await signInAsDemoOfficer(page);

    const chatView = page.getByRole('button', { name: 'Chat View' }).first();
    await chatView.scrollIntoViewIfNeeded();
    await chatView.click();

    // The click lands somewhere visible: the farmer chat with the opening farmer message.
    const composer = page.getByPlaceholder('Type a message to the farmer...');
    await expect(composer).toBeVisible({ timeout: 30_000 });
    const farmerMessage = page.getByRole('group', { name: 'Farmer message' }).first();
    await expect(farmerMessage).toBeVisible();
    await expect(farmerMessage).toContainText('Farmer');
    await expect(page.locator('[data-sender="farmer"]').first()).toBeVisible();

    // The officer's reply and the AI advisory that follows are labelled and placed differently.
    await composer.fill('Scout 20 plants per field and report leaf damage.');
    await page.getByRole('button', { name: 'Send message' }).click();

    const officerMessage = page.getByRole('group', { name: 'Officer message' }).last();
    await expect(officerMessage).toContainText('Scout 20 plants per field and report leaf damage.');
    await expect(page.locator('[data-sender="officer"]').last()).toHaveCSS('justify-content', 'flex-end');

    const aiMessage = page.getByRole('group', { name: 'AI advisory message' }).last();
    await expect(aiMessage).toBeVisible({ timeout: 30_000 });
    await expect(aiMessage).toContainText('AI advisory');
    await expect(page.locator('[data-sender="assistant"]').last()).toHaveCSS('justify-content', 'flex-start');

    // A farmer message never carries the AI label, and vice versa.
    await expect(farmerMessage).not.toContainText('AI advisory');
    await expect(aiMessage).not.toContainText(/^Farmer/);
  });
});
