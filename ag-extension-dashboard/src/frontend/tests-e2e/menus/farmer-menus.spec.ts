import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { JOURNEY, apiAs, expectPaymentsSwitchedOff, openMenu, signedIn } from '../helpers/journey';
import { AI_UNAVAILABLE, CANNED_AI, apiData, statTile } from './menuStories';

/** What a farmer expects from each page in their menu, against the real backend. */
test.describe('a farmer works through every menu page', () => {
  test.setTimeout(180_000);
  const farmer = JOURNEY.farmer.email;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ({ context, page } = await signedIn(browser, farmer));
  });
  test.afterAll(async () => context?.close());

  test('Dashboard: my crops and next visit are the ones on record', async ({ request }) => {
    const stats = await apiData<{ crops: string[]; nextVisitDate: string | null }>(request, farmer, '/api/analytics/farmer-stats');
    await openMenu(page, 'Dashboard');
    for (const crop of stats.crops) await expect(statTile(page, 'My crops')).toContainText(new RegExp(crop, 'i'));
    const next = statTile(page, 'Next visit');
    if (stats.nextVisitDate && stats.nextVisitDate !== 'None') await expect(next).not.toContainText(/None planned/);
    else await expect(next).toContainText(/None planned/);
  });

  test('My officer: names the officer actually assigned to me', async () => {
    await openMenu(page, /^My officer/);
    await expect(page.getByText(SEEDED.officerNakuruName).first()).toBeVisible();
  });

  test('Visits: lists my visits and only mine', async ({ request }) => {
    const { visits } = await apiData<{ visits: Array<{ farmerId: string }> }>(request, farmer, '/api/visits?limit=500');
    expect(visits.every(v => v.farmerId === JOURNEY.farmer.id)).toBe(true);
    await openMenu(page, 'Visits');
    await expect(page.getByRole('button', { name: new RegExp(`^All\\s*${visits.length}$`) })).toBeVisible();
  });

  test('Crops & fields: shows my fields, and another farmer\'s are refused', async ({ request }) => {
    const fields = await apiData<Array<{ name: string }>>(request, farmer, `/api/fields?farmerId=${JOURNEY.farmer.id}`);
    await openMenu(page, 'Crops & fields');
    await expect(statTile(page, 'Fields')).toContainText(String(fields.length));
    for (const field of fields) await expect(page.getByText(field.name).first()).toBeVisible();
    const api = await apiAs(request, farmer);
    expect((await api.get(`/api/fields?farmerId=${SEEDED.mzuzuFarmerId}`)).status()).toBe(403);
  });

  test('AI agronomist: the answer shown is the one the server returned', async () => {
    await openMenu(page, 'AI agronomist');
    const composer = page.getByRole('textbox', { name: /question/i }).first();
    const reply = page.waitForResponse(r => r.url().includes('/api/chatbot/completions'));
    await composer.fill('My beans have yellow leaves after heavy rain. What should I check first?');
    await composer.press('Enter');
    const response = await reply;
    if (response.ok()) {
      const answer: string = (await response.json()).data.messages.at(-1).content;
      await expect(page.getByText(answer.slice(0, 40)).first()).toBeVisible();
      expect(answer).not.toMatch(CANNED_AI);
    } else {
      await expect(page.getByText(AI_UNAVAILABLE).first()).toBeVisible();
    }
  });

  test('Billing: still opens for my paid plan, but nothing can be bought while payments are off', async ({ request }) => {
    await expectPaymentsSwitchedOff(page, request, farmer);
  });
});
