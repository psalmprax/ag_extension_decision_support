import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { JOURNEY, MY_OFFICER_MENU, apiAs, openMenu, pngPhoto, signedIn } from '../helpers/journey';

/**
 * Farmers' and officers' photos are records: a diagnosis, a visit, a conversation. In a pilot
 * they must come back exactly as uploaded, to the people who may see them, and still be there
 * after the next update of the site.
 */
const onSharedSite = Boolean(process.env.E2E_BASE_URL);
const fileUrl = (storageKey: string) => `/api/v1/upload/file/${storageKey}`;

test('a photo comes back exactly as uploaded, and only to people who may see it', async ({ request }) => {
  const officer = await apiAs(request, SEEDED.officerNakuru);
  const photo = pngPhoto(`kept-${Date.now()}.png`, [200, 60, 40], { width: 320, height: 240 });
  const uploaded = await officer.upload(JOURNEY.farmer.id, photo);
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const { filename, sha256, size } = (await uploaded.json()).data as { filename: string; sha256: string; size: number };
  expect(size).toBe(photo.buffer.length);
  expect(sha256).toBe(createHash('sha256').update(photo.buffer).digest('hex'));

  const back = await officer.get(fileUrl(filename));
  expect(back.status()).toBe(200);
  expect(back.headers()['content-type']).toContain('image/png');
  expect(Buffer.from(await back.body()).equals(photo.buffer), 'the stored photo differs from the one uploaded').toBe(true);

  // The farmer it is about can open it; another region's officer, and another farmer, cannot.
  expect((await (await apiAs(request, JOURNEY.farmer.email)).get(fileUrl(filename))).status()).toBe(200);
  expect([403, 404]).toContain((await (await apiAs(request, SEEDED.officerMzuzu)).get(fileUrl(filename))).status());
  expect([403, 404]).toContain((await (await apiAs(request, JOURNEY.otherRegionFarmer.email)).get(fileUrl(filename))).status());
});

test('every photo on the farmer\'s conversation page opens', async ({ browser, request }) => {
  // Put a photo in the thread first, so there is always one to open.
  const farmerApi = await apiAs(request, JOURNEY.farmer.email);
  const uploaded = (await (await farmerApi.upload(JOURNEY.farmer.id, pngPhoto(`thread-${Date.now()}.png`, [90, 150, 60]))).json()) as { data: { id: string } };
  const sent = await farmerApi.post('/api/v1/chatbot/messages', {
    farmerId: JOURNEY.farmer.id, content: 'Photo of the lower leaves this morning.', language: 'en', attachmentIds: [uploaded.data.id],
  });
  expect(sent.status(), await sent.text()).toBeLessThan(300);

  const { context, page } = await signedIn(browser, JOURNEY.farmer.email);
  await openMenu(page, MY_OFFICER_MENU);
  await expect(page.getByRole('group', { name: 'You message' }).filter({ hasText: 'Photo of the lower leaves this morning.' })).toBeVisible();
  const sources = await page.locator('img').evaluateAll(images =>
    images.map(image => (image as HTMLImageElement).getAttribute('src') ?? '').filter(src => src.includes('/upload/file/')),
  );
  expect(sources.length, 'photos on the page').toBeGreaterThan(0);
  const broken: string[] = [];
  for (const src of new Set(sources)) {
    const res = await page.request.get(src);
    if (res.status() !== 200) broken.push(`${src} → ${res.status()}`);
  }
  expect(broken, 'photos that no longer open (lost from storage?)').toEqual([]);
  await context.close();
});

test('on a live site, photos are kept where an update of the site does not remove them', async ({ request }) => {
  test.skip(!onSharedSite, 'the local stack keeps uploads on disk on purpose');
  const officer = await apiAs(request, SEEDED.officerNakuru);
  const info = (await (await officer.get('/api/v1/upload/info')).json()) as { data: { backend: string; isCloud: boolean } };
  // 'local' is the app container's own disk: every deploy recreates the container (docker compose
  // down/up) and nothing in docker-compose.yml keeps that folder, so photos taken before a deploy
  // are lost. Set STORAGE_BACKEND to s3 or r2 in the server's .env.
  expect(info.data.backend, 'uploads are stored inside the app container').not.toBe('local');
  expect(info.data.isCloud).toBe(true);
});
