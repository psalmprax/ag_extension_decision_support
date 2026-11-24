import { expect, test, type Page } from '@playwright/test';
import { SEEDED } from './helpers/auth';
import { E2E_SYSTEM_ADMIN, apiAs, openMenu, signedIn } from './helpers/journey';

/**
 * Field boundaries, soil test history and the audit chain, against the real backend:
 * a farmer maps a field by tapping corners and by walking it (emulated GPS), records two
 * lab results and sees organic carbon change, another region cannot read them, and the
 * system administrator checks that the audit log's hash chain is intact.
 */
const FARMER = 'farmer.nakuru.01@real.agriext.test';
const METRE = 1 / 111_195;
const ORIGIN = { latitude: -0.2827, longitude: 36.0662 };
const at = (east: number, north: number) => ({ latitude: ORIGIN.latitude + north * METRE, longitude: ORIGIN.longitude + east * METRE });

async function openFields(page: Page) {
  await openMenu(page, 'Crops & fields');
  await expect(page.getByRole('heading', { name: 'Crops & fields' })).toBeVisible();
}

async function startNewField(page: Page, name: string, location?: { latitude: number; longitude: number }) {
  await page.getByRole('button', { name: 'Add field' }).first().click();
  await page.getByLabel('Field name').fill(name);
  if (location) {
    // The map opens on the field's location, close enough to tap its corners.
    await page.getByLabel('Latitude').fill(String(location.latitude));
    await page.getByLabel('Longitude').fill(String(location.longitude));
  }
  await page.getByRole('button', { name: 'Map the boundary' }).click();
  return page.getByRole('dialog', { name: 'Map the field boundary' });
}

function cardFor(page: Page, name: string) {
  return page.locator('div').filter({ has: page.getByRole('heading', { name, exact: true }) }).filter({ has: page.getByRole('button', { name: 'Soil tests' }) }).last();
}

test.describe('field boundaries and records', () => {
  test('a farmer maps a field by tapping its corners and the area is measured from it', async ({ browser }) => {
    const { context, page } = await signedIn(browser, FARMER);
    await openFields(page);
    const name = `Tapped plot ${Date.now()}`;
    const editor = await startNewField(page, name, ORIGIN);
    await editor.getByRole('button', { name: 'Tap corners on the map' }).click();

    const map = editor.getByRole('region', { name: 'Satellite map of the field' });
    const box = (await map.boundingBox())!;
    for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    }
    await expect(editor.getByText('Points').locator('..')).toContainText('4');
    await expect(editor.getByText(/Drawn on satellite imagery/)).toBeVisible();
    await editor.getByRole('button', { name: 'Use this boundary' }).click();

    // Within the dialog: earlier fields on this farm have the same words on their cards.
    const fieldDialog = page.getByRole('dialog', { name: 'Add field' });
    await expect(fieldDialog.getByText('measured from the boundary')).toBeVisible();
    await expect(fieldDialog.getByLabel('Area (hectares)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save field' }).click();

    const card = cardFor(page, name);
    await expect(card.getByText(/Area measured from the boundary\. Drawn on the satellite map\./)).toBeVisible();
    await expect(card.getByRole('img', { name: 'Shape of the field' })).toBeVisible();
    await context.close();
  });

  test('a farmer walks the edge with GPS and poor fixes are skipped', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: { ...ORIGIN, accuracy: 4 }, permissions: ['geolocation'] });
    const page = await context.newPage();
    const { loginThroughUi } = await import('./helpers/auth');
    await loginThroughUi(page, FARMER);
    await openFields(page);
    const editor = await startNewField(page, `Walked plot ${Date.now()}`);
    await editor.getByRole('button', { name: 'Start walking' }).click();

    // A 60 m square, one corner at a time; one rough fix in the middle is skipped.
    const route: Array<[number, number, number]> = [[0, 0, 4], [30, 0, 5], [60, 0, 45], [60, 0, 4], [60, 30, 5], [60, 60, 4], [30, 60, 6], [0, 60, 4], [0, 30, 5]];
    for (const [east, north, accuracy] of route) {
      await context.setGeolocation({ ...at(east, north), accuracy });
      if (accuracy > 30) await expect(editor.getByRole('status').filter({ hasText: 'waiting for a better fix' })).toBeVisible();
      await page.waitForTimeout(400);
    }
    await editor.getByRole('button', { name: 'Finish walking' }).click();

    const stats = editor.locator('dl');
    await expect(stats).toContainText('Typical GPS error');
    await expect(stats).toContainText('±5 m');
    await expect(editor.getByText(/the area could be off by up to about/)).toBeVisible();
    await editor.getByRole('button', { name: 'Use this boundary' }).click();
    await expect(page.getByRole('dialog', { name: 'Add field' }).getByText(/Walked with GPS, typical error ±5 m/)).toBeVisible();
    await context.close();
  });

  test('soil tests show organic carbon over the years, and stay inside the region', async ({ browser, request }) => {
    const farmer = await apiAs(request, FARMER);
    const created = await farmer.post('/api/v1/fields', { name: `Soil history ${Date.now()}`, areaHectares: 0.8 });
    expect(created.status()).toBe(201);
    const field = (await created.json()).data as { id: string; name: string };

    expect((await farmer.post(`/api/v1/fields/${field.id}/soil-tests`, { testedAt: '2024-03-12', labName: 'KALRO Nakuru', ph: 5.8, organicCarbonPct: 1.42 })).status()).toBe(201);

    const { context, page } = await signedIn(browser, FARMER);
    await openFields(page);
    const card = cardFor(page, field.name);
    await card.getByRole('button', { name: 'Soil tests' }).click();
    const dialog = page.getByRole('dialog', { name: field.name });
    await dialog.getByRole('button', { name: 'Add a lab result' }).click();
    await dialog.getByLabel('Tested').fill('2026-03-10');
    await dialog.getByLabel('Lab', { exact: true }).fill('KALRO Nakuru');
    await dialog.getByLabel('pH', { exact: true }).fill('6.0');
    await dialog.getByLabel('Organic carbon (%)').fill('1.61');
    await dialog.getByRole('button', { name: 'Save result' }).click();

    await expect(dialog.getByText(/Organic carbon: 1\.42% on .* to 1\.61% on .* \(\+0\.19 percentage points\)/)).toBeVisible();
    await expect(dialog.getByText('All results (2)')).toBeVisible();

    await dialog.getByRole('tab', { name: 'Weather' }).click();
    // No location on this field yet, so nothing is looked up.
    await expect(dialog.getByText(/map its boundary, to see the weather there/)).toBeVisible();
    await context.close();

    const otherRegion = await apiAs(request, SEEDED.officerMzuzu);
    expect((await otherRegion.get(`/api/v1/fields/${field.id}/soil-tests`)).status()).toBe(404);
    expect((await otherRegion.post(`/api/v1/fields/${field.id}/soil-tests`, { testedAt: '2026-01-01', ph: 6 })).status()).toBe(404);
  });

  test('the system administrator finds the audit log chain intact', async ({ browser }) => {
    const { context, page } = await signedIn(browser, E2E_SYSTEM_ADMIN.email, E2E_SYSTEM_ADMIN.password());
    await page.goto('/system-health');
    await page.getByRole('button', { name: 'Check the audit log' }).click();
    // Entries whose account a fixture reset deleted before the actor_key fix are counted apart as
    // uncheckable; nothing may be reported as changed or missing.
    await expect(page.getByText(/^Intact: (all [\d,]+ entries|the [\d,]+ entries .* that can be checked)/).or(page.getByText(/No entries are chained yet/))).toBeVisible();
    await expect(page.getByRole('region', { name: 'Audit log integrity' }).getByRole('alert')).toHaveCount(0);
    await context.close();
  });
});
