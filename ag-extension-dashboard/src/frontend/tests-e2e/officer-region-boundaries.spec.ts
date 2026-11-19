import { expect, test } from '@playwright/test';
import { SEEDED, loginThroughUi } from './helpers/auth';
import { FARMER_CHAT_MENU, JOURNEY, MY_OFFICER_MENU, apiAs, daysFromNow, openMenu, pngPhoto } from './helpers/journey';

/**
 * An extension officer works only with the farmers in their region. Each
 * attempt below targets Loveness Phiri, a Northern Region (Mzuzu) farmer, as
 * the Rift Valley officer — every one must be refused by the server, and the
 * officer's own screens must never offer her.
 */
test.describe('an officer works only with farmers in their region', () => {
  const other = JOURNEY.otherRegionFarmer;

  test('the officer\'s farmer list and visit picker hold only their own farmers', async ({ page }) => {
    await loginThroughUi(page, SEEDED.officerNakuru);
    await openMenu(page, 'Farmers');
    for (const name of SEEDED.nakuruFarmers) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(other.name, { exact: true })).toHaveCount(0);

    await openMenu(page, 'Visits');
    await page.getByRole('button', { name: /Schedule.*Visit/i }).first().click();
    const form = page.locator('form', { has: page.getByLabel('Search farmer') });
    await form.getByLabel('Search farmer').fill('Loveness');
    await expect(form.getByText('No farmers found')).toBeVisible();
  });

  test('the server refuses every action on another region\'s farmer', async ({ request }) => {
    const officer = await apiAs(request, SEEDED.officerNakuru);

    const read = await officer.get(`/api/v1/farmers/${other.id}`);
    expect(read.status()).toBe(403);

    const visit = await officer.post('/api/v1/visits', {
      farmerId: other.id,
      visitType: 'assessment',
      scheduledAt: new Date(`${daysFromNow(3).date}T09:00:00Z`).toISOString(),
    });
    expect(visit.status()).toBe(403);

    const progress = await officer.post(`/api/v1/farmers/${other.id}/progress`, {
      kind: 'observation',
      title: 'Should not be recorded',
      occurredOn: daysFromNow(0).date,
    });
    expect(progress.status()).toBe(403);

    const outcome = await officer.post('/api/v1/efficacy/outcomes', {
      farmerId: other.id,
      crop: 'maize',
      adviceCategory: 'pest',
      adviceSummary: 'Should not be recorded',
      outcome: 'resolved',
    });
    expect(outcome.status()).toBe(403);

    const photo = await officer.upload(other.id, pngPhoto('not-mine.png'));
    expect(photo.status()).toBe(403);

    const message = await officer.post('/api/v1/chatbot/messages', { farmerId: other.id, content: 'Hello from another region' });
    expect(message.status()).toBe(403);

    // Her own officer can, which proves the refusals are about region, not the data.
    const ownOfficer = await apiAs(request, SEEDED.officerMzuzu);
    expect((await ownOfficer.get(`/api/v1/farmers/${other.id}`)).status()).toBe(200);
  });

  test('another region\'s officer cannot read this region\'s conversation or photos', async ({ request }) => {
    const farmer = await apiAs(request, JOURNEY.farmer.email);
    const created = (await (await farmer.post('/api/v1/chatbot/conversations', { kind: 'farmer_thread', language: 'en' })).json()) as {
      data: { id: string; farmerId: string };
    };
    const upload = (await (await farmer.upload(created.data.farmerId, pngPhoto('private-field.png'))).json()) as { data: { id: string; url: string } };
    const sent = await farmer.post('/api/v1/chatbot/messages', {
      conversationId: created.data.id,
      content: 'Photo of my field for my officer',
      attachmentIds: [upload.data.id],
    });
    expect(sent.status()).toBe(201);

    const outsider = await apiAs(request, SEEDED.officerMzuzu);
    expect((await outsider.get(`/api/v1/chatbot/conversations/${created.data.id}/messages`)).status()).toBe(403);
    expect((await outsider.get(upload.data.url)).status()).toBe(403);

    const ownOfficer = await apiAs(request, SEEDED.officerNakuru);
    expect((await ownOfficer.get(upload.data.url)).status()).toBe(200);
  });

  test('a farmer cannot attach another farmer\'s photo to their message', async ({ request }) => {
    const otherFarmer = await apiAs(request, other.email);
    const theirs = (await (await otherFarmer.upload(other.id, pngPhoto('their-field.png'))).json()) as { data: { id: string } };

    const farmer = await apiAs(request, JOURNEY.farmer.email);
    const thread = (await (await farmer.post('/api/v1/chatbot/conversations', { kind: 'farmer_thread', language: 'en' })).json()) as { data: { id: string } };
    const res = await farmer.post('/api/v1/chatbot/messages', { conversationId: thread.data.id, content: 'Look', attachmentIds: [theirs.data.id] });
    expect(res.status()).toBe(400);
  });

  test('a farmer on the Free plan has no officer chat, and the server refuses it', async ({ page }) => {
    // The officer chat is a paid feature: a Free farmer's menu does not offer it…
    await loginThroughUi(page, JOURNEY.freeFarmer.email);
    await expect(page.getByRole('navigation').first().getByRole('button', { name: MY_OFFICER_MENU })).toHaveCount(0);

    // …and the API refuses the thread with an upgrade prompt, not an error.
    const farmer = await apiAs(page.request, JOURNEY.freeFarmer.email);
    const res = await farmer.post('/api/v1/chatbot/conversations', { kind: 'farmer_thread', language: 'en' });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ upgradeRequired: true });
  });

  test('the officer\'s chat lists only their own farmers\' threads', async ({ page }) => {
    // Loveness writes to her own officer…
    const otherFarmer = await apiAs(page.request, other.email);
    const thread = (await (await otherFarmer.post('/api/v1/chatbot/conversations', { kind: 'farmer_thread', language: 'en' })).json()) as { data: { id: string } };
    await otherFarmer.post('/api/v1/chatbot/messages', { conversationId: thread.data.id, content: 'Hello Chisomo, my groundnuts are wilting.' });

    // …and the Rift Valley officer never sees that thread.
    await loginThroughUi(page, SEEDED.officerNakuru);
    await openMenu(page, FARMER_CHAT_MENU);
    await expect(page.getByRole('button', { name: new RegExp(other.name) })).toHaveCount(0);
    await expect(page.getByText('my groundnuts are wilting')).toHaveCount(0);

    // Nor does the Rift Valley manager's live activity feed (it used to show every region's messages).
    const manager = await apiAs(page.request, SEEDED.managerNakuru.email);
    const feed = (await (await manager.get('/api/v1/activities/triage')).json()) as { data: Array<{ farmerName: string; region: string }> };
    expect(feed.data.map(item => item.farmerName)).not.toContain(other.name);
    for (const item of feed.data) expect(item.region).toBe(SEEDED.managerNakuru.region);
    const otherManager = await apiAs(page.request, SEEDED.managerMzuzu.email);
    const theirs = (await (await otherManager.get('/api/v1/activities/triage')).json()) as { data: Array<{ farmerName: string }> };
    expect(theirs.data.map(item => item.farmerName)).toContain(other.name);
  });
});
