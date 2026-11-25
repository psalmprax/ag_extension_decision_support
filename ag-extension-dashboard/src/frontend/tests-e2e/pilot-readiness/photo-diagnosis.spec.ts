import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { SEEDED, loginThroughUi } from '../helpers/auth';
import { imageSizeOf, openMenu, pngPhoto } from '../helpers/journey';

/**
 * An officer checks a leaf photo, as they will many times a day in a pilot.
 *
 *  1. When the model on the phone is sure about a crop it knows, it answers alone and the photo
 *     is not sent online (no AI cost).
 *  2. When it is not sure, the photo goes to the online check, shrunk to 1,024 px on its long
 *     side first, and the answer (or an honest "unavailable") is shown.
 *  3. With no signal, the photo is queued, and it is sent once the connection is back.
 *
 * What a real model makes of a test photo cannot be known in advance, so a stand-in model of a
 * few hundred bytes is served in place of the real one: it always answers "maize, fall
 * armyworm, 98%" (fixtures/make_stand_in_model.py). Everything else is the deployed app: the
 * phone's ONNX runtime, the manifest rules, the screens and the online check.
 */
const STAND_IN_MODEL = readFileSync(new URL('../fixtures/stand-in-disease-model.onnx', import.meta.url));
// The app calls it under /api or /api/v1, depending on how the site is built.
const ONLINE_CHECK = '/ai/diseases/diagnose/image';
const MAX_SIDE = 1024;

/** The manifest the app reads: one model that passes the field gate, sure from 60% for maize or for no crop. */
function standInManifest(sureForMaize: boolean) {
  return {
    models: [{
      file: 'e2e-stand-in.onnx',
      name: 'Stand-in model for the user stories',
      labels: ['corn___healthy', 'corn___fall_armyworm'],
      output: 'probabilities',
      inputSize: 224,
      fieldEvaluation: {
        dataset: 'stand-in', images: 400, top1Accuracy: 0.9, top3Accuracy: 0.99, cropTop1Accuracy: 0.99, evaluatedOn: '2026-11-25',
      },
      calibration: {
        basis: 'stand-in', target: 0.9, confidentAt: 0.6, points: [], cropsMeetingTarget: sureForMaize ? ['corn'] : [],
      },
    }],
  };
}

/** An officer's browser that loads the stand-in model instead of the real one. */
async function officerWithStandIn(browser: Browser, sureForMaize: boolean): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.route('**/models/manifest.json', route => route.fulfill({ json: standInManifest(sureForMaize) }));
  await context.route('**/models/e2e-stand-in.onnx*', route => route.fulfill({ body: STAND_IN_MODEL, contentType: 'application/octet-stream' }));
  const page = await context.newPage();
  await loginThroughUi(page, SEEDED.officerNakuru);
  await openMenu(page, 'Disease diagnosis');
  await page.getByRole('tab', { name: 'Leaf photo' }).click();
  return { context, page };
}

async function checkPhoto(page: Page, photo: ReturnType<typeof pngPhoto>, crop = 'maize'): Promise<void> {
  const another = page.getByRole('button', { name: 'Choose another photo' });
  if (await another.isVisible()) await another.click();
  await page.locator('#image-upload').setInputFiles(photo);
  await page.locator('#diagnosis-photo-crop').fill(crop);
  await page.getByRole('button', { name: 'Check this photo' }).click();
}

/** The photo sent for the online check: its crop and its size. */
function sentPhoto(request: Request): { cropType?: string; width: number; height: number } {
  const body = request.postDataJSON() as { imageData: string; cropType?: string };
  return { cropType: body.cropType, ...imageSizeOf(body.imageData) };
}

test.describe.serial('a leaf photo is checked on the phone first', () => {
  let officer: { context: BrowserContext; page: Page };
  const sentOnline: Request[] = [];

  test.beforeAll(async ({ browser }) => {
    officer = await officerWithStandIn(browser, true);
    officer.page.on('request', request => {
      if (request.url().includes(ONLINE_CHECK) && request.method() === 'POST') sentOnline.push(request);
    });
  });
  test.afterAll(async () => officer?.context.close());

  test('when the phone is sure about a crop it knows, it answers alone and nothing is sent online', async () => {
    const { page } = officer;
    await checkPhoto(page, pngPhoto('fall-armyworm-leaf.png', [96, 128, 52], { width: 640, height: 480 }));

    await expect(page.getByText('Checked on this phone').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('The model on this phone was sure enough, so the photo was not sent for the online check.')).toBeVisible();
    // The label maps to the known condition, shown by its own name.
    await expect(page.getByText('Fall Armyworm (FAW) Infestation').first()).toBeVisible();
    // A phone answer is never a prescription.
    await expect(page.getByText(/Not confirmed\. Treatment advice is held back until an extension officer confirms the diagnosis\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check with the online model' })).toBeVisible();
    expect(sentOnline, 'the sure answer must not call the online check').toHaveLength(0);
  });

  test('with no signal the photo is queued, and sent, shrunk, once the connection is back', async () => {
    const { context, page } = officer;
    await context.setOffline(true);
    await checkPhoto(page, pngPhoto('no-signal-leaf.png', [110, 140, 60], { width: 2400, height: 1800 }));

    await expect(page.getByText('No connection. The photo is queued for the online check.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Queued for the online check')).toBeVisible();
    expect(sentOnline).toHaveLength(0);

    const replay = page.waitForRequest(request => request.url().includes(ONLINE_CHECK) && request.method() === 'POST', { timeout: 90_000 });
    await context.setOffline(false);
    const sent = sentPhoto(await replay);
    expect(sent.cropType).toBe('maize');
    expect(Math.max(sent.width, sent.height)).toBeLessThanOrEqual(MAX_SIDE);
    const response = await (await replay).response();
    // The queued check reached the server; a 503 says honestly that the analysis is unavailable.
    expect(response && (response.status() < 500 || response.status() === 503), `queued check answered ${response?.status()}`).toBe(true);
  });
});

test('when the phone is not sure, the photo goes to the online check, shrunk to 1,024 px', async ({ browser }) => {
  const { context, page } = await officerWithStandIn(browser, false);
  const request = page.waitForRequest(r => r.url().includes(ONLINE_CHECK) && r.method() === 'POST', { timeout: 60_000 });
  await checkPhoto(page, pngPhoto('unsure-leaf.png', [120, 150, 70], { width: 2400, height: 1600 }));

  const sent = sentPhoto(await request);
  expect(sent.cropType).toBe('maize');
  expect(Math.max(sent.width, sent.height)).toBe(MAX_SIDE);
  // The online answer, or the honest message that no diagnosis was made; never a silent failure.
  await expect(page.getByText(/Source:|Analysis unavailable|is unavailable|could not process|Could not reach/).first()).toBeVisible({ timeout: 120_000 });
  await context.close();
});
