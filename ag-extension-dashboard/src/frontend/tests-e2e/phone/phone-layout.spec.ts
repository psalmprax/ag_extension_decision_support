import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { loginThroughUi, SEEDED } from '../helpers/auth';
import { JOURNEY } from '../helpers/journey';

/**
 * The landing page and the signed-in dashboards on a phone, in Chrome and in Firefox
 * (the mobile-chrome and mobile-firefox projects). Most farmers and officers use a phone,
 * so: nothing may scroll sideways, the page title stays readable, the floating chat button
 * does not cover text, and a screenshot of each screen is kept for a person to look at.
 */

/** Elements wider than the screen, by tag and class; empty when nothing scrolls sideways. */
async function widerThanScreen(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= limit + 1) return [] as string[];
    return Array.from(document.querySelectorAll('body *'))
      .filter(node => {
        const box = (node as HTMLElement).getBoundingClientRect();
        return box.width > 0 && box.right > limit + 1 && getComputedStyle(node).position !== 'fixed';
      })
      .slice(0, 5)
      .map(node => `${node.tagName.toLowerCase()}.${String((node as HTMLElement).className).split(' ').slice(0, 4).join('.')}`);
  });
}

/**
 * Text that stays under the floating chat button even when scrolled as far as it goes.
 * Text passing under it while scrolling is normal for a floating button; text at the very
 * end of the page has nowhere to move to, so the page needs room below it.
 */
async function textStuckUnderChatButton(page: Page): Promise<string[]> {
  const button = page.getByRole('button', { name: /agronomic assistant/i });
  if (!(await button.count())) return [];
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  const box = await button.boundingBox();
  if (!box) return [];
  return page.evaluate(({ x, y, width, height }) => {
    const covered = new Set<string>();
    for (let px = x + 4; px < x + width; px += 12) {
      for (let py = y + 4; py < y + height; py += 12) {
        for (const node of document.elementsFromPoint(px, py)) {
          if (node.closest('button[aria-haspopup="dialog"]')) continue;
          const text = Array.from(node.childNodes)
            .filter(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
            .map(child => child.textContent?.trim())
            .join(' ');
          if (text) covered.add(text.slice(0, 60));
        }
      }
    }
    return [...covered];
  }, box);
}

async function keepScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`phone-${testInfo.project.name}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`${name} (${testInfo.project.name})`, { path, contentType: 'image/png' });
}

async function expectFitsPhone(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.waitForTimeout(800);
  expect(await widerThanScreen(page), `${name}: nothing may scroll sideways`).toEqual([]);
  const title = page.locator('h1').first();
  if (await title.count()) {
    const size = await title.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    expect(size, `${name}: the page title stays readable on a phone`).toBeGreaterThanOrEqual(24);
  }
  await keepScreenshot(page, testInfo, name);
}

test('landing page fits a phone and the chat button covers no text', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await expectFitsPhone(page, testInfo, 'landing');

  expect(await textStuckUnderChatButton(page), 'text left under the floating chat button at the end of the page').toEqual([]);
});

for (const [role, email] of [['officer', SEEDED.officerNakuru], ['farmer', JOURNEY.farmer.email]] as const) {
  test(`${role} dashboard fits a phone`, async ({ page }, testInfo) => {
    await loginThroughUi(page, email);
    await page.locator('main').first().waitFor();
    await expectFitsPhone(page, testInfo, `${role}-dashboard`);
  });
}
