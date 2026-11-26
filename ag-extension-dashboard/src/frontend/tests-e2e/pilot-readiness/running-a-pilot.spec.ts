import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { apiAs, daysFromNow, openMenu, signedIn } from '../helpers/journey';

/**
 * A regional manager runs a season-long pilot: farmers in the region are split at random
 * into a service group and a comparison group, asked for their harvests, and the
 * evaluator gets the data without names. Another region's manager never sees it.
 *
 * Starting a pilot and asking for harvests send SMS to the region's farmers, so on a live
 * site the story stops after creating the pilot (the fixture reset removes it).
 */
const onSharedSite = Boolean(process.env.E2E_BASE_URL);
const NAME = `Maize season pilot ${Date.now()}`;

interface PilotRow { id: string; name: string; status: string; region: string }

test('a manager sets up a pilot that only their region can see', async ({ browser, request }) => {
  const { context, page } = await signedIn(browser, SEEDED.managerNakuru.email);
  await openMenu(page, 'Analytics');
  const pilots = page.getByRole('region', { name: 'Pilots', exact: true });
  await pilots.getByRole('button', { name: 'New pilot' }).click();

  const form = pilots.getByRole('form', { name: 'New pilot' });
  await form.getByLabel('Name').fill(NAME);
  await expect(form.getByLabel('Region')).toHaveValue(SEEDED.managerNakuru.region);
  await form.getByLabel('Crop').fill('maize');
  await form.getByLabel('Season starts').fill(daysFromNow(-30).date);
  await form.getByLabel('Season ends').fill(daysFromNow(150).date);
  await form.getByRole('button', { name: 'Create pilot' }).click();
  await expect(pilots.getByText(`${SEEDED.managerNakuru.region}, maize,`)).toBeVisible();
  await expect(pilots.getByText('Not started', { exact: true })).toBeVisible();

  const mine = ((await (await (await apiAs(request, SEEDED.managerNakuru.email)).get('/api/v1/pilots')).json()) as { data: PilotRow[] }).data;
  const pilot = mine.find(row => row.name === NAME);
  expect(pilot?.status).toBe('draft');

  // Another region's manager cannot list it, open it or act on it.
  const other = await apiAs(request, SEEDED.managerMzuzu.email);
  const theirs = ((await (await other.get('/api/v1/pilots')).json()) as { data: PilotRow[] }).data;
  expect(theirs.map(row => row.id)).not.toContain(pilot!.id);
  expect([403, 404]).toContain((await other.get(`/api/v1/pilots/${pilot!.id}`)).status());
  expect([403, 404]).toContain((await other.post(`/api/v1/pilots/${pilot!.id}/start`, {})).status());
  // Officers and farmers do not run pilots.
  expect((await (await apiAs(request, SEEDED.officerNakuru)).post('/api/v1/pilots', { name: 'Not mine' })).status()).toBe(403);

  if (onSharedSite) {
    await context.close();
    return;
  }

  // Start: every active farmer in the region lands in exactly one group.
  await pilots.getByRole('button', { name: 'Start and split farmers' }).click();
  const started = page.getByText(/^Started: \d+ farmers in the service group, \d+ in the comparison group\.$/);
  await expect(started).toBeVisible();
  const [service, comparison] = ((await started.innerText()).match(/\d+/g) ?? []).map(Number);
  expect(service + comparison).toBeGreaterThan(0);
  await expect(pilots.getByText('Running', { exact: true })).toBeVisible();

  await expect(pilots.getByRole('row', { name: /^Farmers\s+\d/ })).toContainText(String(service));
  await expect(pilots.getByText('No difference to show yet: both groups need farmers who reported both harvests.')).toBeVisible();

  // Ask for last season's harvest (no SMS provider on the local stack: nobody is texted).
  await pilots.getByRole('button', { name: 'Ask for last season’s harvest' }).click();
  await expect(page.getByText(/^Asked \d+ farmers\. \d+ could not be reached or turned notices off\.$/)).toBeVisible();

  // The evaluator's file has the groups but no names or phone numbers.
  const download = page.waitForEvent('download');
  await pilots.getByRole('button', { name: 'Data for the evaluator (CSV, no names)' }).click();
  const csv = readFileSync(await (await download).path(), 'utf8');
  expect(csv.split('\n').filter(Boolean).length).toBe(service + comparison + 1);
  for (const name of SEEDED.nakuruFarmers) {
    for (const part of name.split(' ')) expect(csv, `the export names ${part}`).not.toContain(part);
  }
  expect(csv).not.toMatch(/\+254\d{6,}/);

  await pilots.getByRole('button', { name: 'Close pilot' }).click();
  await expect(page.getByText('Pilot closed.')).toBeVisible();
  await expect(pilots.getByText('Closed', { exact: true })).toBeVisible();
  await context.close();
});
