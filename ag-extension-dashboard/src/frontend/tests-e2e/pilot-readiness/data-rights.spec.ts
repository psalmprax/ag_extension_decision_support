import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { apiAs, daysFromNow, pngPhoto, uniquePhone } from '../helpers/journey';

/**
 * A farmer in the pilot asks for a copy of their data, then asks for it to be deleted (Kenya's
 * Data Protection Act gives them both rights). Their officer exports everything held about
 * them, then erases it: the record, visit notes, photos and their conversation. What stays is
 * an anonymous row, so the pilot's counts still add up.
 */
const RUN = Date.now();
const LAST_NAME = `Erasure${RUN}`;
const VISIT_NOTES = `Checked the irrigation line with ${LAST_NAME} (${RUN})`;
const MESSAGE = `Hello Faith ${LAST_NAME}, I will bring the soil test results on Monday.`;

interface Export {
  farmer: { first_name: string; last_name: string; phone: string | null; is_active: boolean };
  visits: Array<{ notes: string | null }>;
  uploads: Array<{ sha256: string; status: string }>;
}

test('a farmer gets a copy of their data, then has it erased', async ({ request }) => {
  const officer = await apiAs(request, SEEDED.officerNakuru);
  const phone = uniquePhone();
  const registered = await officer.post('/api/v1/farmers', {
    firstName: 'Faith', lastName: LAST_NAME, phone, region: SEEDED.managerNakuru.region, village: 'Bahati', farmSize: 0.8, crops: ['beans'],
  });
  expect(registered.status(), await registered.text()).toBe(201);
  const farmerId = ((await registered.json()) as { data: { id: string } }).data.id;

  const photo = pngPhoto(`erasure-${RUN}.png`, [30, 120, 60], { width: 64, height: 48 });
  const uploaded = await officer.upload(farmerId, photo);
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const storageKey = ((await uploaded.json()) as { data: { filename: string } }).data.filename;
  expect((await officer.post('/api/v1/visits', {
    farmer_id: farmerId, visit_type: 'assessment', scheduled_at: `${daysFromNow(2).date}T08:00:00.000Z`, notes: VISIT_NOTES,
  })).status()).toBeLessThan(300);
  const sent = await officer.post('/api/v1/chatbot/messages', { farmerId, content: MESSAGE });
  expect(sent.status(), await sent.text()).toBe(201);
  const conversationId = ((await sent.json()) as { data: { conversationId: string } }).data.conversationId;

  // The copy: everything held about the farmer, for their officer only.
  const exportPath = `/api/v1/data-rights/farmers/${farmerId}/export`;
  expect([403, 404]).toContain((await (await apiAs(request, SEEDED.officerMzuzu)).get(exportPath)).status());
  const copy = ((await (await officer.get(exportPath)).json()) as { data: Export }).data;
  expect(copy.farmer).toMatchObject({ first_name: 'Faith', last_name: LAST_NAME, phone });
  expect(copy.visits.map(visit => visit.notes)).toContain(VISIT_NOTES);
  expect(copy.uploads.map(upload => upload.sha256)).toContain(createHash('sha256').update(photo.buffer).digest('hex'));

  // Erasure needs an explicit confirmation, and no one outside the farmer's team can ask for it.
  const erasePath = `/api/v1/data-rights/farmers/${farmerId}`;
  expect((await officer.delete(erasePath, {})).status()).toBe(400);
  expect([403, 404]).toContain((await (await apiAs(request, SEEDED.officerMzuzu)).delete(erasePath, { confirm: true })).status());
  const erased = await officer.delete(erasePath, { confirm: true });
  expect(erased.status(), await erased.text()).toBe(200);

  // Afterwards nothing identifies the farmer: not the record, the visit, the photo or the messages.
  const after = ((await (await officer.get(exportPath)).json()) as { data: Export }).data;
  expect(after.farmer).toMatchObject({ first_name: 'Deleted', last_name: 'Farmer', phone: null, is_active: false });
  expect(after.visits.length, 'the visit stays, for the pilot counts').toBeGreaterThan(0);
  expect(after.visits.every(visit => visit.notes === null)).toBe(true);
  expect(after.uploads.every(upload => upload.status === 'deleted')).toBe(true);
  expect([403, 404, 410]).toContain((await officer.get(`/api/v1/upload/file/${storageKey}`)).status());

  const messages = await officer.get(`/api/v1/chatbot/conversations/${conversationId}/messages`);
  if (messages.ok()) expect(await messages.text(), 'the conversation still shows the message').not.toContain(LAST_NAME);
  const farmers = await officer.get(`/api/v1/farmers?search=${LAST_NAME}`);
  expect(await farmers.text(), 'the farmer list still names the farmer').not.toContain(LAST_NAME);
  const visits = await officer.get(`/api/v1/visits?farmerId=${farmerId}`);
  expect(await visits.text()).not.toContain(VISIT_NOTES);
});
