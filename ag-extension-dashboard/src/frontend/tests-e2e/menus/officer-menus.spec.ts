import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { JOURNEY, apiAs, expectBillingSwitchedOff, openMenu, signedIn } from '../helpers/journey';
import { AI_UNAVAILABLE, CANNED_AI, apiData, statTile } from './menuStories';

/**
 * What an extension officer expects from each page in their menu, checked against the
 * real backend: figures equal what the API holds, lists hold exactly their farmers, and
 * each page's main action is saved (it is still there after a reload).
 */
interface Farmer { id: string; firstName: string; lastName: string }
interface Visit { status: string }

test.describe('an extension officer works through every menu page', () => {
  test.setTimeout(180_000);
  const officer = SEEDED.officerNakuru;
  let context: BrowserContext;
  let page: Page;
  let farmers: Farmer[] = [];

  test.beforeAll(async ({ browser, request }) => {
    ({ context, page } = await signedIn(browser, officer));
    farmers = (await apiData<{ farmers: Farmer[] }>(request, officer, '/api/farmers?limit=200')).farmers;
  });
  test.afterAll(async () => context?.close());

  test('Dashboard: the headline figures are the ones the server holds', async ({ request }) => {
    const { overview } = await apiData<{ overview: Record<string, number> }>(request, officer, '/api/analytics/dashboard');
    await openMenu(page, 'Dashboard');
    await expect(statTile(page, 'My farmers')).toContainText(String(overview.totalFarmers));
    await expect(statTile(page, 'Active chats')).toContainText(String(overview.activeConversations));
    // "My farmers" counts the same people the Farmers page lists.
    expect(overview.totalFarmers).toBe(farmers.length);
  });

  test('Farmers: the list holds exactly my farmers, search narrows it, and the CSV matches', async () => {
    await openMenu(page, 'Farmers');
    for (const farmer of farmers) {
      await expect(page.getByRole('heading', { name: `${farmer.firstName} ${farmer.lastName}` }).first()).toBeVisible();
    }
    for (const name of SEEDED.mzuzuFarmers) await expect(page.getByText(name)).toHaveCount(0);

    await page.getByPlaceholder('Search by name, region or crop').fill('Njeri');
    await expect(page.getByRole('heading', { name: 'Mary Njeri' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Joseph Kimani' })).toHaveCount(0);
    await page.getByPlaceholder('Search by name, region or crop').fill('');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export CSV/ }).click();
    const csv = await (await download).createReadStream().then(stream => new Promise<string>(resolve => {
      let text = '';
      stream.on('data', chunk => (text += chunk));
      stream.on('end', () => resolve(text));
    }));
    const rows = csv.trim().split('\n').slice(1);
    expect(rows).toHaveLength(farmers.length);
    for (const farmer of farmers) expect(csv).toContain(farmer.lastName);
  });

  test('Visits: the tab counts are the visits on record', async ({ request }) => {
    const { visits } = await apiData<{ visits: Visit[] }>(request, officer, '/api/visits?limit=500');
    const count = (status: string) => visits.filter(v => v.status === status).length;
    await openMenu(page, 'Visits');
    await expect(page.getByRole('button', { name: new RegExp(`^All\\s*${visits.length}$`) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`^Upcoming\\s*${count('scheduled')}$`) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`^Completed\\s*${count('completed')}$`) })).toBeVisible();
  });

  test('Crops & fields: a field added for a farmer is saved and counted', async ({ request }) => {
    const name = `Riverside plot ${Date.now() % 100000}`;
    await openMenu(page, 'Crops & fields');
    await page.getByLabel('Farmer').selectOption({ label: `${JOURNEY.farmer.name} (Rift Valley)` });
    const fieldsPath = `/api/fields?farmerId=${JOURNEY.farmer.id}`;
    const before = (await apiData<unknown[]>(request, officer, fieldsPath)).length;
    await expect(statTile(page, 'Fields')).toContainText(String(before));
    await page.getByRole('button', { name: 'Add field' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Add field/ });
    await dialog.getByLabel('Field name').fill(name);
    // Kenyan farmers measure land in acres, so the form asks in acres and stores hectares.
    await dialog.getByLabel('Area (acres)').fill('2');
    await dialog.getByLabel('Soil type').fill('Loam');
    await dialog.getByRole('button', { name: 'Save field' }).click();
    await expect(page.getByText(name)).toBeVisible();
    await expect(statTile(page, 'Fields')).toContainText(String(before + 1));

    const fields = await apiData<Array<{ name: string; areaHectares?: number | string; area_hectares?: number | string }>>(request, officer, fieldsPath);
    const saved = fields.find(f => f.name === name);
    expect(Number(saved?.areaHectares ?? saved?.area_hectares)).toBeCloseTo(0.81, 2);
    await page.reload();
    await openMenu(page, 'Crops & fields');
    await page.getByLabel('Farmer').selectOption({ label: `${JOURNEY.farmer.name} (Rift Valley)` });
    await expect(page.getByText(name)).toBeVisible();
  });

  test('Disease diagnosis: described symptoms get a real answer (or an honest "not available"), never canned advice', async () => {
    await openMenu(page, 'Disease diagnosis');
    await page.getByRole('tab', { name: 'Describe symptoms' }).click();
    const reply = page.waitForResponse(r => /\/api\/(ai|diagnos|diseases)/.test(r.url()) && r.request().method() === 'POST');
    await page.getByLabel('Crop', { exact: true }).fill('Maize');
    const sign = page.getByLabel('What do you see?');
    await sign.fill('Long grey-tan lesions along the lower leaves');
    await sign.press('Enter');
    await page.getByRole('button', { name: /Check symptoms/ }).click();
    const response = await reply;
    const result = page.getByRole('region', { name: 'Result' });
    if (response.ok()) {
      await expect(result).toContainText(/officer|expert/i);
      await expect(result).not.toContainText(CANNED_AI);
    } else {
      await expect(page.getByText(AI_UNAVAILABLE).first()).toBeVisible();
    }
  });

  test('Reports: the government export holds exactly my farmers, by reference number', async () => {
    await openMenu(page, 'Reports');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Farmers CSV' }).click();
    const file = await download;
    const text = await new Promise<string>((resolve, reject) => {
      file.createReadStream().then(stream => {
        let body = '';
        stream.on('data', chunk => (body += chunk));
        stream.on('end', () => resolve(body));
        stream.on('error', reject);
      }, reject);
    });
    const [version, header, ...rows] = text.trim().split('\n');
    expect(version).toMatch(/^mis_version=/);
    expect(header.split(',')[0]).toBe('farmer_ref');
    const exported = new Set(rows.map(row => row.split(',')[0]));
    expect([...exported].sort()).toEqual(farmers.map(f => f.id).sort());
    // Pseudonymised: no farmer's name leaves the system in a government export.
    for (const farmer of farmers) expect(text).not.toContain(farmer.lastName);
  });

  test('Farm map: shows my farmers on a globe, and no one else\'s', async ({ request }) => {
    const layers = await apiData<{ farmers: Array<{ id: string }> }>(request, officer, '/api/worldmonitor/layers');
    const mine = new Set(farmers.map(f => f.id));
    expect(layers.farmers.every(point => mine.has(point.id)), 'map points outside my farmers').toBe(true);
    await openMenu(page, 'Farm map');
    await expect(page.getByRole('img', { name: /globe/i })).toBeVisible();
    await expect(page.getByText(new RegExp(`${layers.farmers.length} farmers? on the map`))).toBeVisible();
  });

  test('SMS: the history is the messages on record, and a long message shows its part count', async ({ request }) => {
    const history = await apiData<Array<{ message: string }>>(request, officer, '/api/sms/history');
    await openMenu(page, 'SMS');
    await page.getByRole('button', { name: 'History' }).click();
    if (history.length) await expect(page.getByText(history[0].message.slice(0, 30)).first()).toBeVisible();
    await page.getByRole('button', { name: 'Compose' }).click();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Scout your maize this week. '.repeat(7));
    await expect(page.getByText(/2 SMS/)).toBeVisible();
  });

  test('AI agronomist: the answer shown is the one the server returned', async () => {
    await openMenu(page, 'AI agronomist');
    const composer = page.getByRole('textbox', { name: /question/i }).first();
    const reply = page.waitForResponse(r => r.url().includes('/api/chatbot/completions'));
    await composer.fill('How do I tell fall armyworm damage from stalk borer damage in maize?');
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

  test('Knowledge: a search shows its sources, or says plainly that none matched', async () => {
    await openMenu(page, 'Knowledge');
    const reply = page.waitForResponse(r => /\/api\/knowledge\/(search|query|ask)/.test(r.url()));
    const box = page.getByRole('searchbox').first();
    await box.fill('maize streak virus symptoms');
    await box.press('Enter');
    const response = await reply;
    // A 503 is the server saying the assistant is down and nothing matched; the page must say so.
    expect(response.status() < 500 || response.status() === 503, `knowledge search failed: ${response.status()}`).toBe(true);
    await expect(page.getByText(/Sources|No sources matched|not available right now|is unavailable/).first()).toBeVisible();
  });

  test('Billing: switched off while pricing is decided, so there is nothing to pay', async ({ request }) => {
    await expectBillingSwitchedOff(page, request, officer);
  });

  test('Advisory Studio: a saved protocol is still there after a reload', async ({ request }) => {
    const name = `Armyworm scouting ${Date.now() % 100000}`;
    await openMenu(page, 'Advisory Studio');
    await page.getByLabel('Protocol name').fill(name);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    const workflows = await apiData<Array<{ title: string }>>(request, officer, '/api/workflows');
    expect(workflows.map(w => w.title)).toContain(name);
    await page.reload();
    await openMenu(page, 'Advisory Studio');
    await expect(page.getByRole('button', { name })).toBeVisible();
  });

  test('a page refuses another region\'s farmer even when asked directly', async ({ request }) => {
    const api = await apiAs(request, officer);
    expect((await api.get(`/api/fields?farmerId=${SEEDED.mzuzuFarmerId}`)).status()).toBe(403);
  });
});
