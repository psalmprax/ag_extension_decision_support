import { expect, test, type Page } from '@playwright/test';
import { SEEDED, loginThroughUi } from './helpers/auth';
import { JOURNEY, apiAs, openMenu, uniquePhone } from './helpers/journey';

/**
 * Farmer registration by field staff, against the real backend: an officer
 * registers farmers to themselves in their own region, a regional manager
 * registers them in theirs and assigns one of their own officers, and the
 * server refuses either of them reaching into another region.
 */

interface FarmerRow {
  id: string;
  firstName: string;
  lastName: string;
  region: string;
  village?: string;
  assignedOfficerId?: string | null;
}

async function fillRegistration(page: Page, first: string, last: string, village: string): Promise<void> {
  await page.getByPlaceholder('e.g. Samuel').fill(first);
  await page.getByPlaceholder('e.g. Kiprono').fill(last);
  await page.getByPlaceholder('+254 712 345 678').fill(uniquePhone());
  await page.getByPlaceholder('e.g. Nakuru, Rongai').fill(village);
}

async function findFarmer(page: Page, last: string): Promise<FarmerRow | undefined> {
  const res = await page.request.get(`/api/v1/farmers?search=${encodeURIComponent(last)}&limit=100`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { data: { farmers: FarmerRow[] } };
  return body.data.farmers.find(f => f.lastName === last);
}

test.describe('farmer registration by field staff', () => {
  test('an officer registers a farmer to themselves, in their own region', async ({ page }) => {
    const last = `Wekesa${Date.now()}`;
    await loginThroughUi(page, SEEDED.officerNakuru);
    await openMenu(page, 'Farmers');
    await page.getByRole('button', { name: 'Register farmer' }).click();
    await expect(page).toHaveURL(/\/register-farmer$/);

    // The region is the officer's own; what they type is the village.
    await expect(page.getByText('Registered in your region: Rift Valley')).toBeVisible();
    // An officer's farmers are their own: there is no officer to choose.
    await expect(page.getByLabel('Assigned extension officer')).toHaveCount(0);

    await fillRegistration(page, 'Grace', last, 'Bahati');
    await page.getByRole('button', { name: /Enroll Farmer Client/ }).click();
    await expect(page.getByText(/registered successfully/i)).toBeVisible();

    const farmer = await findFarmer(page, last);
    expect(farmer).toMatchObject({ firstName: 'Grace', region: 'Rift Valley', assignedOfficerId: JOURNEY.officerNakuruId });
  });

  test('an officer cannot register a farmer outside their region', async ({ request }) => {
    const officer = await apiAs(request, SEEDED.officerNakuru);
    const last = `Outside${Date.now()}`;

    const res = await officer.post('/api/v1/farmers', {
      firstName: 'Tiwonge',
      lastName: last,
      phone: uniquePhone('+265'),
      region: SEEDED.managerMzuzu.region,
      village: 'Chibavi',
      farmSize: 1.2,
      crops: ['maize'],
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ success: false, code: 'FARMER_OUTSIDE_OFFICER_REGION' });

    // Nothing was created.
    const list = await officer.get(`/api/v1/farmers?search=${last}`);
    const body = (await list.json()) as { data: { farmers: FarmerRow[] } };
    expect(body.data.farmers.filter(f => f.lastName === last)).toHaveLength(0);
  });

  test('a regional manager registers a farmer and assigns one of their own officers', async ({ page }) => {
    const last = `Cheruiyot${Date.now()}`;
    await loginThroughUi(page, SEEDED.managerNakuru.email);
    await openMenu(page, 'Farmers');
    await page.getByRole('button', { name: 'Register farmer' }).click();

    await expect(page.getByText('Registered in your region: Rift Valley')).toBeVisible();
    const picker = page.getByLabel('Assigned extension officer');
    // Only officers from the manager's own region are offered.
    await expect(picker.getByRole('option', { name: new RegExp(SEEDED.officerNakuruName) })).toHaveCount(1);
    await expect(picker.getByRole('option', { name: new RegExp(SEEDED.officerMzuzuName) })).toHaveCount(0);
    await picker.selectOption({ label: `${SEEDED.officerNakuruName} — Rift Valley` });

    await fillRegistration(page, 'Kibet', last, 'Njoro');
    await page.getByRole('button', { name: /Enroll Farmer Client/ }).click();
    await expect(page.getByText(/registered successfully/i)).toBeVisible();

    const farmer = await findFarmer(page, last);
    expect(farmer).toMatchObject({ region: 'Rift Valley', assignedOfficerId: JOURNEY.officerNakuruId });
  });

  test('a regional manager cannot assign another region\'s officer', async ({ request }) => {
    const manager = await apiAs(request, SEEDED.managerNakuru.email);
    const res = await manager.post('/api/v1/farmers', {
      firstName: 'Faith',
      lastName: `Crossed${Date.now()}`,
      phone: uniquePhone(),
      region: SEEDED.managerNakuru.region,
      village: 'Molo',
      farmSize: 2,
      crops: ['beans'],
      assignedOfficerId: JOURNEY.officerMzuzuId,
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'OFFICER_OUTSIDE_MANAGER_REGION' });
  });

  test('a farmer account has no way to register farmers', async ({ page }) => {
    await loginThroughUi(page, JOURNEY.farmer.email);
    await expect(page.getByRole('button', { name: 'Farmers', exact: true })).toHaveCount(0);
    await page.goto('/register-farmer');
    // The tab guard sends a farmer back to their own dashboard.
    await expect(page.getByRole('button', { name: /Enroll Farmer Client/ })).toHaveCount(0);
  });
});
