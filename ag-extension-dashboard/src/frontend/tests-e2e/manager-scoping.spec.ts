import { expect, test } from '@playwright/test';
import { SEEDED, apiToken, loginThroughUi } from './helpers/auth';

/**
 * Manager scoping against the real backend and the real-world seed.
 *
 * A regional manager may only see farmers in their own region: the list is
 * filtered by the region stored on the manager's account, and a direct read of
 * a farmer in another region is refused outright.
 */
test.describe('regional manager scoping', () => {
  test('the Nakuru manager lists exactly the Rift Valley farmers', async ({ page }) => {
    await loginThroughUi(page, SEEDED.managerNakuru.email);

    const res = await page.request.get('/api/v1/farmers?limit=100');
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      data: { farmers: Array<{ firstName: string; lastName: string; region: string }> };
    };
    const farmers = body.data.farmers;
    const names = farmers.map(farmer => `${farmer.firstName} ${farmer.lastName}`);

    expect(new Set(names)).toEqual(new Set(SEEDED.nakuruFarmers));
    for (const farmer of farmers) {
      expect(farmer.region).toBe(SEEDED.managerNakuru.region);
    }
    expect(names).not.toContain(SEEDED.mzuzuFarmers[0]);
  });

  test('the Mzuzu manager lists exactly the Northern Region farmers', async ({ page }) => {
    await loginThroughUi(page, SEEDED.managerMzuzu.email);

    const res = await page.request.get('/api/v1/farmers?limit=100');
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      data: { farmers: Array<{ firstName: string; lastName: string; region: string }> };
    };
    const names = body.data.farmers.map(farmer => `${farmer.firstName} ${farmer.lastName}`);

    expect(new Set(names)).toEqual(new Set(SEEDED.mzuzuFarmers));
    for (const farmer of body.data.farmers) {
      expect(farmer.region).toBe(SEEDED.managerMzuzu.region);
    }
    for (const kenyan of SEEDED.nakuruFarmers) {
      expect(names).not.toContain(kenyan);
    }
  });

  test('a manager cannot read a farmer from another region', async ({ request }) => {
    const token = await apiToken(request, SEEDED.managerNakuru.email);

    const res = await request.get(`/api/v1/farmers/${SEEDED.mzuzuFarmerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });
});
