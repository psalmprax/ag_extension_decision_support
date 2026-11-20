import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { openMenu, signedIn } from '../helpers/journey';
import { apiData, statTile } from './menuStories';

/** What a regional manager expects from each page in their menu: their region, all of it, nothing else. */
interface Farmer { id: string; firstName: string; lastName: string; region: string }

test.describe('a regional manager works through every menu page', () => {
  test.setTimeout(180_000);
  const manager = SEEDED.managerNakuru;
  let context: BrowserContext;
  let page: Page;
  let farmers: Farmer[] = [];

  test.beforeAll(async ({ browser, request }) => {
    ({ context, page } = await signedIn(browser, manager.email));
    farmers = (await apiData<{ farmers: Farmer[] }>(request, manager.email, '/api/farmers?limit=500')).farmers;
  });
  test.afterAll(async () => context?.close());

  test('the region\'s farmers are the whole of what the manager sees', () => {
    expect(farmers.length).toBeGreaterThan(0);
    expect(farmers.every(f => f.region === manager.region)).toBe(true);
  });

  test('Dashboard: total farmers is the region\'s count', async ({ request }) => {
    const { overview } = await apiData<{ overview: Record<string, number> }>(request, manager.email, '/api/analytics/dashboard');
    expect(overview.totalFarmers).toBe(farmers.length);
    await openMenu(page, 'Dashboard');
    await expect(statTile(page, 'Total farmers')).toContainText(String(farmers.length));
  });

  test('Visits: the tab counts are the region\'s visits', async ({ request }) => {
    const { visits } = await apiData<{ visits: Array<{ status: string; farmerId: string }> }>(request, manager.email, '/api/visits?limit=500');
    const ids = new Set(farmers.map(f => f.id));
    expect(visits.every(v => ids.has(v.farmerId))).toBe(true);
    await openMenu(page, 'Visits');
    await expect(page.getByRole('button', { name: new RegExp(`^All\\s*${visits.length}$`) })).toBeVisible();
  });

  test('Crops & fields: the farmer picker offers the region\'s farmers only', async () => {
    await openMenu(page, 'Crops & fields');
    const picker = page.getByLabel('Farmer');
    await expect(picker.locator('option')).toHaveCount(farmers.length);
    const options = await picker.locator('option').allInnerTexts();
    for (const name of SEEDED.mzuzuFarmers) expect(options.join('|')).not.toContain(name);
  });

  test('Farm map: the region\'s farmers only', async ({ request }) => {
    const layers = await apiData<{ farmers: Array<{ id: string }> }>(request, manager.email, '/api/worldmonitor/layers');
    const ids = new Set(farmers.map(f => f.id));
    expect(layers.farmers.every(point => ids.has(point.id))).toBe(true);
    await openMenu(page, 'Farm map');
    await expect(page.getByText(new RegExp(`${layers.farmers.length} farmers? on the map`))).toBeVisible();
  });

  test('SMS: the page loads its quota and history without refused requests', async () => {
    const refused: string[] = [];
    page.on('response', r => { if (r.url().includes('/api/') && r.status() === 403) refused.push(r.url()); });
    await openMenu(page, 'SMS');
    await expect(page.getByText(/SMS quota/)).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(refused).toEqual([]);
  });
});
