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

  test('an extension officer may still enroll a farmer', async ({ request }) => {
    const token = await apiToken(request, 'officer.nakuru@real.agriext.test');

    // Enrolled in Coast, which no seeded manager covers: the manager-scoping
    // spec asserts an exact Rift Valley set, and this row must not join it.
    const res = await request.post('/api/v1/farmers', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        firstName: 'E2E',
        lastName: 'Enrolled',
        region: 'Coast',
        village: 'Malindi',
        farmSize: 1.5,
        crops: ['maize'],
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { assignedOfficerId?: string | null };
    };
    expect(body.success).toBe(true);
    expect(body.data.assignedOfficerId).toBeTruthy();
  });
});
