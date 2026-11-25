import { expect, test } from '@playwright/test';
import { SEEDED, SEEDED_PASSWORD, uniqueOfficerEmail } from '../helpers/auth';
import { JOURNEY, apiAs, daysFromNow, e2eAdmin, uniquePhone } from '../helpers/journey';

/**
 * Staff change during a pilot. An administrator adds an officer to the Rift Valley team; the
 * new officer gets a farmer and plans a visit. When the officer leaves, the account is
 * switched off at once, and the manager hands the farmer to a colleague in the region, who
 * finds the farmer's visit history and can carry on. A farmer can never be handed to an
 * officer in another region.
 */
const RUN = Date.now();
const VISIT_NOTES = `Soil sampling before planting (${RUN})`;

interface Visit { id: string; notes: string | null }

test('when an officer leaves, their farmers move to a colleague with their history', async ({ request }) => {
  const admin = e2eAdmin();
  test.skip(!admin, 'adding staff needs this run\'s administrator');
  // On a live site the region may also have a real manager, whose organisation the new
  // account would join: the story only adds staff on the local stack.
  test.skip(Boolean(process.env.E2E_BASE_URL), 'adds and removes staff accounts');
  const administrator = await apiAs(request, admin!.email, admin!.password);

  // A new officer joins the region's team, in the regional manager's organisation, on the
  // Pro plan the pilot's field staff work on (visits are a paid feature).
  const plans = ((await (await administrator.get('/api/v1/billing/quotas')).json()) as { data: Array<{ id: string; name: string }> }).data;
  const pro = plans.find(plan => /^pro$/i.test(plan.name));
  expect(pro, 'the Pro plan').toBeTruthy();
  const email = uniqueOfficerEmail();
  const created = await administrator.post('/api/v1/users', {
    email, password: SEEDED_PASSWORD, firstName: 'Grace', lastName: `Leaving${RUN}`,
    role: 'extension_officer', region: SEEDED.managerNakuru.region, country: 'Kenya', planId: pro!.id,
  });
  expect(created.status(), await created.text()).toBe(201);
  const leaverId = ((await created.json()) as { data: { id: string } }).data.id;

  const manager = await apiAs(request, SEEDED.managerNakuru.email);
  const registered = await manager.post('/api/v1/farmers', {
    firstName: 'Peris', lastName: `Handover${RUN}`, phone: uniquePhone(), region: SEEDED.managerNakuru.region,
    village: 'Njoro', farmSize: 1.5, crops: ['maize'], assignedOfficerId: leaverId,
  });
  expect(registered.status(), await registered.text()).toBe(201);
  const farmerId = ((await registered.json()) as { data: { id: string } }).data.id;

  // The new officer can work with the farmer straight away.
  const leaver = await apiAs(request, email);
  expect((await leaver.get(`/api/v1/farmers/${farmerId}`)).status(), 'the new officer opens their farmer').toBe(200);
  const planned = await leaver.post('/api/v1/visits', {
    farmer_id: farmerId, visit_type: 'assessment', scheduled_at: `${daysFromNow(3).date}T08:00:00.000Z`, notes: VISIT_NOTES,
  });
  expect(planned.status(), await planned.text()).toBeLessThan(300);

  // The officer leaves: the account is switched off and signed out everywhere.
  expect((await administrator.delete(`/api/v1/users/${leaverId}`)).status()).toBe(200);
  expect((await request.post('/api/v1/auth/login', { data: { email, password: SEEDED_PASSWORD } })).status()).toBeGreaterThanOrEqual(400);
  expect([401, 403]).toContain((await leaver.get(`/api/v1/farmers/${farmerId}`)).status());

  // Nobody can hand the farmer to another region's officer.
  const crossRegion = await manager.post('/api/v1/farmers/bulk/update', { ids: [farmerId], updates: { assignedOfficerId: JOURNEY.officerMzuzuId } });
  const refused = (await crossRegion.json()) as { data?: { failed: number; errors: string[] } };
  expect(refused.data?.failed, await crossRegion.text()).toBe(1);
  expect(refused.data?.errors.join(' ')).toContain('Regional managers can only assign officers from their own region');
  // An officer cannot reassign farmers at all.
  const daniel = await apiAs(request, SEEDED.officerNakuru);
  expect((await daniel.post('/api/v1/farmers/bulk/update', { ids: [farmerId], updates: { assignedOfficerId: JOURNEY.officerNakuruId } })).status()).toBe(403);

  // The manager hands the farmer to Daniel, in the same region.
  const handed = await manager.post('/api/v1/farmers/bulk/update', { ids: [farmerId], updates: { assignedOfficerId: JOURNEY.officerNakuruId } });
  expect(((await handed.json()) as { data: { processed: number; failed: number } }).data).toMatchObject({ processed: 1, failed: 0 });
  // ...and it cannot go back to the officer who left.
  const back = (await (await manager.post('/api/v1/farmers/bulk/update', { ids: [farmerId], updates: { assignedOfficerId: leaverId } })).json()) as { data?: { failed: number } };
  expect(back.data?.failed).toBe(1);

  // Daniel has the farmer, finds the visit the previous officer planned, and takes it over.
  const record = (await (await daniel.get(`/api/v1/farmers/${farmerId}`)).json()) as { data: { assignedOfficerId: string } };
  expect(record.data.assignedOfficerId).toBe(JOURNEY.officerNakuruId);
  const visits = ((await (await daniel.get(`/api/v1/visits?farmerId=${farmerId}`)).json()) as { data: { visits: Visit[] } }).data.visits;
  const inherited = visits.find(visit => visit.notes === VISIT_NOTES);
  expect(inherited, 'the visit planned before the handover').toBeTruthy();
  const takenOver = await daniel.patch(`/api/v1/visits/${inherited!.id}`, { notes: `${VISIT_NOTES}. Taken over by Daniel Kiptoo.` });
  expect(takenOver.status(), await takenOver.text()).toBe(200);
});
