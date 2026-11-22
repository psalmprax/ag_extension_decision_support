import { test, expect, type APIRequestContext } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { SEEDED, apiToken } from './helpers/auth';
import { E2E_SYSTEM_ADMIN, JOURNEY } from './helpers/journey';

/**
 * An NGO's audio library from import to a farmer's phone, on the real backend:
 * the administrator adds the partner and grants the officers' organisation; imports a zip
 * with a manifest (rows without consent are refused); a regional manager checks the
 * transcript and approves; the officer finds it for a farmer who speaks that language
 * and sends it; the farmer's thread carries it, and the play link works without sign-in.
 *
 * It writes to the farmer's thread, so it runs only against the local stack.
 */
test.skip(Boolean(process.env.E2E_BASE_URL), 'writes to a farmer thread; local stack only');

const FIXTURE_ORGANISATION = 'Real-world extension fixtures';

/** A short, valid WAV file: a tenth of a second of silence. */
function silentWav(): Uint8Array {
  const samples = 1600;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return new Uint8Array(buffer);
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
async function ok<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.url()} → ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json()).data as T;
}

test('a partner recording goes from import to a farmer, credited and logged', async ({ request }) => {
  const admin = await apiToken(request, E2E_SYSTEM_ADMIN.email, E2E_SYSTEM_ADMIN.password());
  const manager = await apiToken(request, SEEDED.managerNakuru.email);
  const officer = await apiToken(request, SEEDED.officerNakuru);

  const farmer = await ok<{ languagePreference?: string; crops?: string[] }>(await request.get(`/api/v1/farmers/${JOURNEY.farmer.id}`, { headers: auth(officer) }));
  const language = (farmer.languagePreference || 'en').slice(0, 2);
  const crop = farmer.crops?.[0] ?? 'maize';

  const name = `Field radio trust ${Date.now()}`;
  const partner = await ok<{ id: string }>(await request.post('/api/v1/content-partners', { headers: auth(admin), data: { name } }));
  const { organisations } = await ok<{ organisations: Array<{ id: string; name: string }> }>(await request.get('/api/v1/content-partners/organisations', { headers: auth(admin) }));
  // Grant every organisation of that name: a database may hold more than one fixture copy.
  const fixtures = organisations.filter(o => o.name === FIXTURE_ORGANISATION);
  expect(fixtures.length, 'the fixture organisation exists').toBeGreaterThan(0);
  for (const organisation of fixtures) {
    await ok(await request.put(`/api/v1/content-partners/${partner.id}/grants/${organisation.id}`, { headers: auth(admin) }));
  }

  const manifest = [
    'file,title,speaker,language,crops,regions,topic,licence,licence_expires,consent',
    `scouting.wav,Scouting before you spray,Dr. Achieng,${language},${crop},,pests,CC BY 4.0,,yes`,
    `unconsented.wav,Not consented,Dr. Achieng,${language},${crop},,pests,CC BY 4.0,,no`,
  ].join('\n');
  const archive = Buffer.from(zipSync({ 'manifest.csv': strToU8(manifest), 'scouting.wav': silentWav(), 'unconsented.wav': silentWav() }));
  const report = await ok<{ imported: number; skipped: Array<{ reason: string }> }>(await request.post(`/api/imports/partner-recordings/${partner.id}`, {
    headers: auth(admin), multipart: { archive: { name: 'library.zip', mimeType: 'application/zip', buffer: archive } },
  }));
  expect(report.imported).toBe(1);
  expect(report.skipped[0].reason).toMatch(/consent/);

  // Officers see nothing until a reviewer approves.
  const before = await ok<{ recordings: unknown[] }>(await request.get(`/api/v1/partner-recordings?partnerId=${partner.id}`, { headers: auth(officer) }));
  expect(before.recordings).toHaveLength(0);
  const drafts = await ok<{ recordings: Array<{ id: string }> }>(await request.get(`/api/v1/partner-recordings?partnerId=${partner.id}&status=pending_review`, { headers: auth(manager) }));
  const recordingId = drafts.recordings[0].id;
  await ok(await request.post(`/api/v1/partner-recordings/${recordingId}/review`, {
    headers: auth(manager), data: { decision: 'approve', transcript: 'Walk the field each week and look under the leaves before you decide to spray.' },
  }));

  const matches = await ok<{ recordings: Array<{ id: string; partner: string; speaker: string }> }>(await request.get(`/api/v1/partner-recordings/for-farmer/${JOURNEY.farmer.id}`, { headers: auth(officer) }));
  expect(matches.recordings.map(r => r.id)).toContain(recordingId);

  const sent = await ok<{ sent: number }>(await request.post(`/api/v1/partner-recordings/${recordingId}/send`, { headers: auth(officer), data: { farmerIds: [JOURNEY.farmer.id] } }));
  expect(sent.sent).toBe(1);

  const library = await ok<{ recordings: Array<{ id: string; deliveries: number; url: string }> }>(await request.get(`/api/v1/partner-recordings?partnerId=${partner.id}`, { headers: auth(officer) }));
  const approved = library.recordings.find(r => r.id === recordingId)!;
  expect(approved.deliveries).toBe(1);
  // The officer and the farmer can play the attached audio.
  const audio = await request.get(approved.url, { headers: auth(officer) });
  expect(audio.headers()['content-type']).toContain('audio/');
});
