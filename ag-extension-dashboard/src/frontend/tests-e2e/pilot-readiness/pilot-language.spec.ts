import { expect, test, type Page } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { openMenu, signedIn } from '../helpers/journey';
import { AI_UNAVAILABLE } from '../menus/menuStories';

/**
 * The Kenyan pilot works in Kiswahili. An officer and a farmer switch the app to Swahili:
 * the menus and forms they use are in Swahili and stay so after a reload, and the farmer's
 * question is answered in Swahili (or they are told, in Swahili, that the AI cannot answer).
 */
const RAW_KEY = /\bui_[a-z0-9]+(?:_[a-z0-9]+)+\b/;
const alice = { email: 'farmer.nakuru.03@real.agriext.test' };
const RUN = Date.now();

async function switchToSwahili(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select language/ }).first().click();
  await page.getByRole('option', { name: /Swahili/ }).click();
  await expect(page.getByRole('button', { name: /Chagua Lugha/i }).first()).toBeVisible();
}

async function expectNoRawKeys(page: Page, where: string): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text.match(RAW_KEY)?.[0] ?? null, `raw translation key on ${where}`).toBeNull();
}

/** Swahili and English function words: an answer in Swahili has many more of the first. */
const SWAHILI_WORDS = /\b(?:na|ya|kwa|wa|ni|la|za|katika|kama|hii|kwamba|au|pia|mimea|mahindi|shamba|afisa|ugani|kuhusu|tafadhali)\b/gi;
const ENGLISH_WORDS = /\b(?:the|and|of|to|is|in|for|with|your|this|that|or|are|you)\b/gi;
const countOf = (text: string, words: RegExp) => text.match(words)?.length ?? 0;

test('an officer works in Swahili, and the choice survives a reload', async ({ browser }) => {
  const { context, page } = await signedIn(browser, SEEDED.officerNakuru);
  await switchToSwahili(page);

  for (const menu of ['Wakulima', 'Ziara']) {
    await openMenu(page, menu);
    await page.waitForLoadState('networkidle');
    await expectNoRawKeys(page, menu);
  }
  await page.reload();
  await expect(page.getByRole('navigation').first().getByRole('button', { name: 'Ziara', exact: true })).toBeVisible({ timeout: 30_000 });
  await context.close();
});

test('a farmer asks in Swahili and is answered in Swahili', async ({ browser }) => {
  const { context, page } = await signedIn(browser, alice.email);
  await switchToSwahili(page);
  await openMenu(page, /^Afisa wangu/);
  await expect(page.getByRole('heading', { name: 'Afisa wangu', exact: true })).toBeVisible();
  await expectNoRawKeys(page, 'the farmer\'s conversation page');

  const sent = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/chatbot/messages') && request.method() === 'POST');
  await page.getByLabel('Ujumbe kwa afisa wako').fill(`Majani ya mahindi yangu yana madoa ya njano (${RUN}). Nifanye nini?`);
  await page.getByRole('button', { name: 'Uliza AI', exact: true }).click();
  expect((await sent).postDataJSON().language, 'the question is saved as Swahili').toBe('sw');

  const answer = page.locator('[data-sender="assistant"] [role="group"]').last();
  // Locally there is no AI provider: the farmer is then told plainly that it did not answer.
  const refusal = page.getByRole('alert').filter({ hasText: new RegExp(`${AI_UNAVAILABLE.source}|haikuweza|imeshindwa|umetumia`, 'i') });
  await expect(answer.or(refusal).first()).toBeVisible({ timeout: 120_000 });
  if (!(await answer.isVisible())) {
    test.info().annotations.push({ type: 'ai', description: 'The AI did not answer on this site.' });
    await context.close();
    return;
  }
  const text = await answer.locator('[data-message]').innerText();
  const swahili = countOf(text, SWAHILI_WORDS);
  const english = countOf(text, ENGLISH_WORDS);
  expect(swahili, `the answer reads as Swahili (Swahili words ${swahili}, English words ${english}): ${text.slice(0, 200)}`).toBeGreaterThan(english);
  await context.close();
});
