import { expect, test, type Page } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { apiAs, openMenu } from './helpers/journey';

/**
 * Where a field is walked there is often no signal. A farmer walks a field's edge and records a
 * lab result with the phone offline; both are kept on the phone and marked as waiting, then
 * reach the server once the connection is back.
 */
const FARMER = 'farmer.nakuru.01@real.agriext.test';
const METRE = 1 / 111_195;
const ORIGIN = { latitude: -0.2861, longitude: 36.0712 };
const at = (east: number, north: number) => ({ latitude: ORIGIN.latitude + north * METRE, longitude: ORIGIN.longitude + east * METRE });

function cardFor(page: Page, name: string) {
  return page.locator('div').filter({ has: page.getByRole('heading', { name, exact: true }) }).filter({ has: page.getByRole('button', { name: 'Soil tests' }) }).last();
}

test('a field walked and tested with no signal syncs when the connection is back', async ({ browser, request }) => {
  const context = await browser.newContext({ geolocation: { ...ORIGIN, accuracy: 4 }, permissions: ['geolocation'] });
  const page = await context.newPage();
  await loginThroughUi(page, FARMER);
  await openMenu(page, 'Crops & fields');
  await expect(page.getByRole('heading', { name: 'Crops & fields' })).toBeVisible();

  // Open the editor once with a connection, as the app would have been opened before going out.
  await page.getByRole('button', { name: 'Add field' }).first().click();
  await page.getByRole('button', { name: 'Map the boundary' }).click();
  const editor = page.getByRole('dialog', { name: 'Map the field boundary' });
  await expect(editor.getByRole('button', { name: 'Start walking' })).toBeVisible();

  await context.setOffline(true);
  const name = `Offline plot ${Date.now()}`;
  await editor.getByRole('button', { name: 'Start walking' }).click();
  for (const [east, north] of [[0, 0], [50, 0], [50, 40], [0, 40]]) {
    await context.setGeolocation({ ...at(east, north), accuracy: 4 });
    await page.waitForTimeout(400);
  }
  await editor.getByRole('button', { name: 'Finish walking' }).click();
  await editor.getByRole('button', { name: 'Use this boundary' }).click();
  await page.getByLabel('Field name').fill(name);
  await page.getByRole('button', { name: 'Save field' }).click();

  await expect(page.getByText('Saved on this device. It syncs when you are back online.').first()).toBeVisible();
  await expect(page.getByText(/No connection\. These are the fields kept on this device/)).toBeVisible();
  const card = cardFor(page, name);
  await expect(card.getByText('Waiting to sync')).toBeVisible();

  await card.getByRole('button', { name: 'Soil tests' }).click();
  const dialog = page.getByRole('dialog', { name });
  await dialog.getByRole('button', { name: 'Add a lab result' }).click();
  await dialog.getByLabel('Tested').fill('2026-11-02');
  await dialog.getByLabel('pH', { exact: true }).fill('5.9');
  await dialog.getByRole('button', { name: 'Save result' }).click();
  await expect(dialog.getByText('All results (1)')).toBeVisible();
  await expect(dialog.getByText('Waiting to sync')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await context.setOffline(false);
  await expect(card.getByText('Waiting to sync')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText(/No connection\. These are the fields/)).toHaveCount(0);

  const farmer = await apiAs(request, FARMER);
  const fields = (await (await farmer.get('/api/v1/fields')).json()).data as Array<{ id: string; name: string; boundaryMethod: string; areaHectares: number }>;
  const saved = fields.find(field => field.name === name);
  expect(saved).toMatchObject({ boundaryMethod: 'walked' });
  // A 50 m by 40 m rectangle is 0.2 ha.
  expect(Number(saved?.areaHectares)).toBeCloseTo(0.2, 2);
  const tests = (await (await farmer.get(`/api/v1/fields/${saved?.id}/soil-tests`)).json()).data as Array<{ ph: number }>;
  expect(tests.map(result => result.ph)).toEqual([5.9]);
  await context.close();
});
