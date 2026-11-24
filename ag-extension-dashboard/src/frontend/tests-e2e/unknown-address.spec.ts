import { expect, test } from '@playwright/test';
import { SEEDED } from './helpers/auth';
import { signedIn } from './helpers/journey';

/** A signed-in person who opens an address no screen answers is told so and taken back. */
test('an unknown address inside the app says so and returns to the open screen', async ({ browser }) => {
  const { context, page } = await signedIn(browser, SEEDED.officerNakuru);
  await page.goto('/fields');
  await expect(page.getByRole('heading', { name: 'Crops & fields' })).toBeVisible();
  await page.goto('/no-such-screen');
  await expect(page.getByText('There is no page at /no-such-screen.')).toBeVisible();
  await expect(page).toHaveURL(/\/(fields|dashboard)$/);
  await context.close();
});
