import { expect, test } from '@playwright/test';
import { apiToken } from './helpers/auth';

/**
 * Farmer enrollment is staff work. The farmers router admits all four roles so
 * a farmer can read its own record, so the create path needs its own gate: a
 * farmer account must not be able to mint unassigned records for the extension
 * team to reconcile.
 */
test.describe('farmer record creation', () => {
  test('a farmer account is refused', async ({ request }) => {
    const token = await apiToken(request, 'farmer.nakuru.01@real.agriext.test');

    const res = await request.post('/api/v1/farmers', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        firstName: 'Should',
        lastName: 'Fail',
        region: 'Rift Valley',
        village: 'Bahati',
        farmSize: 1,
        crops: ['maize'],
      },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('cannot create farmer records');
  });

  test('an extension officer may still enroll a farmer in their own region', async ({ request }) => {
    const token = await apiToken(request, 'officer.nakuru@real.agriext.test');

    const res = await request.post('/api/v1/farmers', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        firstName: 'E2E',
        lastName: `Enrolled${Date.now()}`,
        region: 'Rift Valley',
        village: 'Bahati',
        farmSize: 1.5,
        crops: ['maize'],
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { assignedOfficerId?: string | null; region?: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.assignedOfficerId).toBeTruthy();
    expect(body.data.region).toBe('Rift Valley');
  });

  test('an extension officer cannot enroll a farmer outside their region', async ({ request }) => {
    const token = await apiToken(request, 'officer.nakuru@real.agriext.test');

    // Coast is not the officer's region (Rift Valley), so the record is refused.
    const res = await request.post('/api/v1/farmers', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        firstName: 'E2E',
        lastName: 'Elsewhere',
        region: 'Coast',
        village: 'Malindi',
        farmSize: 1.5,
        crops: ['maize'],
      },
    });

    expect(res.status()).toBe(403);
  });
});
