import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SEEDED, loginThroughUi } from './helpers/auth';
import { FARMER_CHAT_MENU, MY_OFFICER_MENU, apiAs, daysFromNow, openMenu } from './helpers/journey';

/**
 * Trust in what the officer reports and sends, against the real backend:
 *
 *  1. Verified visits: Daniel files a report standing on Samuel's farm, and one
 *     2 km away; each report records where it was filed, and the regional
 *     manager sees which visits were confirmed on the farm.
 *  2. AI-drafted replies: Daniel edits a copilot draft before sending it. Samuel
 *     sees the reply was drafted with AI and checked by his officer; the edit
 *     goes to the agronomic review queue with both versions.
 */
const samuel = {
  id: 'e4000000-0000-4000-8000-000000000002',
  email: 'farmer.nakuru.02@real.agriext.test',
  name: 'Samuel Kipchumba',
  // His registered farm (realWorldSeed): Rongai, Nakuru.
  farm: { latitude: -0.1667, longitude: 35.8667 },
};
// About 2.2 km north of the farm.
const awayFromFarm = { latitude: -0.1467, longitude: 35.8667 };

async function scheduleVisit(page: Page, notes: string): Promise<void> {
  const officer = await apiAs(page.request, SEEDED.officerNakuru);
  const res = await officer.post('/api/v1/visits', {
    farmer_id: samuel.id, visit_type: 'assessment', scheduled_at: `${daysFromNow(0).date}T08:00:00.000Z`, notes,
  });
  expect(res.status(), 'schedule the visit').toBeLessThan(300);
}

async function fileReport(page: Page, findings: string): Promise<void> {
  // A fresh page: the visits list is reloaded and starts on its "All" view.
  await page.reload();
  await openMenu(page, 'Visits');
  await page.getByRole('button', { name: `Complete (${samuel.name})` }).first().click();
  const report = page.getByRole('dialog', { name: new RegExp(`Visit report: ${samuel.name}`) });
  await expect(report.getByText('Your location is saved with the report')).toBeVisible();
  await report.getByLabel('Findings *').fill(findings);
  await report.getByLabel('Time on farm (minutes)').fill('40');
  await report.getByRole('checkbox', { name: 'The farmer needs a follow-up' }).uncheck();
  await report.getByRole('button', { name: 'Complete visit' }).click();
  await expect(report).toHaveCount(0);
}

async function completedVisitChecks(page: Page): Promise<Array<{ outcomes: string | null; locationCheck: { status: string; distanceM: number | null } | null }>> {
  const officer = await apiAs(page.request, SEEDED.officerNakuru);
  const body = (await (await officer.get(`/api/v1/visits?farmerId=${samuel.id}&status=completed`)).json()) as {
    data: { visits: Array<{ outcomes: string | null; locationCheck: { status: string; distanceM: number | null } | null }> };
  };
  return body.data.visits;
}

test.describe.serial('verified visits', () => {
  let officer: { context: BrowserContext; page: Page };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { ...samuel.farm, accuracy: 15 } });
    const page = await context.newPage();
    await loginThroughUi(page, SEEDED.officerNakuru);
    officer = { context, page };
  });

  test.afterAll(async () => {
    await officer?.context.close();
  });

  test('a report filed on the farm is verified', async () => {
    await scheduleVisit(officer.page, 'Check sorghum stand after planting');
    await fileReport(officer.page, 'Sorghum stand even; two gaps re-sown in the lower plot.');
    const visit = (await completedVisitChecks(officer.page)).find(v => v.outcomes?.startsWith('Sorghum stand even'));
    expect(visit?.locationCheck).toMatchObject({ status: 'on_farm' });
    expect(visit!.locationCheck!.distanceM).toBeLessThanOrEqual(5);
    await officer.page.getByRole('button', { name: /Completed/ }).first().click();
    await expect(officer.page.getByTestId('visit-location').filter({ hasText: 'Verified on the farm' }).first()).toBeVisible();
  });

  test('a report filed 2 km away is flagged, and the manager sees both', async ({ browser }) => {
    await officer.context.setGeolocation({ ...awayFromFarm, accuracy: 12 });
    await scheduleVisit(officer.page, 'Bring soil test results');
    await fileReport(officer.page, 'Discussed the soil test by phone; lime recommended.');
    const visit = (await completedVisitChecks(officer.page)).find(v => v.outcomes?.startsWith('Discussed the soil test'));
    expect(visit?.locationCheck).toMatchObject({ status: 'away' });
    expect(visit!.locationCheck!.distanceM).toBeGreaterThan(2000);

    const managerContext = await browser.newContext();
    const manager = await managerContext.newPage();
    await loginThroughUi(manager, SEEDED.managerNakuru.email);
    await openMenu(manager, 'Visits');
    await manager.getByRole('button', { name: /Completed/ }).first().click();
    await expect(manager.getByTestId('visit-location').filter({ hasText: /Filed 2\.\d km from the farm/ }).first()).toBeVisible();
    await expect(manager.getByTestId('visit-location').filter({ hasText: 'Verified on the farm' }).first()).toBeVisible();
    await managerContext.close();
  });
});

test.describe('AI-drafted replies', () => {
  const draft = 'Thanks Samuel. How many rows show the gaps, and did the seed come from last season?';
  const sent = 'Thanks Samuel. How many rows show the gaps? I will bring certified seed on Thursday.';

  test("the farmer sees the reply was drafted with AI and checked; the officer's edit is queued for review", async ({ page, request }) => {
    const officerApi = await apiAs(request, SEEDED.officerNakuru);
    const res = await officerApi.post('/api/v1/chatbot/messages', { farmerId: samuel.id, content: sent, aiDraft: { text: draft } });
    expect(res.status()).toBeLessThan(300);
    const message = ((await res.json()) as { data: { metadata?: { aiDraft?: { edited: boolean } }; content: string } }).data;
    expect(message.metadata?.aiDraft).toEqual({ edited: true });
    // The draft itself is never stored on the message the farmer can read.
    expect(JSON.stringify(message)).not.toContain('last season');

    // Officers and managers review the correction, with both versions.
    const manager = await apiAs(request, SEEDED.managerNakuru.email);
    await expect.poll(async () => {
      const reviews = (await (await manager.get('/api/v1/ai/reviews?status=pending')).json()) as { data: Array<{ trigger: string | null; recommendation: string }> };
      return reviews.data.some(r => r.trigger === 'officer_edit' && r.recommendation.includes(draft) && r.recommendation.includes(sent));
    }).toBe(true);

    await loginThroughUi(page, samuel.email);
    await openMenu(page, MY_OFFICER_MENU);
    const reply = page.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'certified seed on Thursday' });
    await expect(reply).toContainText('Drafted with AI and checked by your officer');
  });

  test('the officer sees which replies came from a draft', async ({ page }) => {
    await loginThroughUi(page, SEEDED.officerNakuru);
    await openMenu(page, FARMER_CHAT_MENU);
    await page.getByRole('button', { name: new RegExp(samuel.name) }).first().click();
    await expect(page.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'certified seed on Thursday' }))
      .toContainText('From an AI draft, edited before sending');
  });
});
