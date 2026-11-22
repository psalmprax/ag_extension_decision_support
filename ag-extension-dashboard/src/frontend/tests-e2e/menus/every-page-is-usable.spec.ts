import { test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SEEDED } from '../helpers/auth';
import { E2E_SYSTEM_ADMIN, JOURNEY, signedIn } from '../helpers/journey';
import { expectNoProblems, menuItems, openItem } from './honesty';

/**
 * Every page in every role's menu must be usable by everyone it is for: no serious or
 * critical accessibility failures (WCAG 2.1 A and AA, checked by axe), and nothing wider
 * than a phone screen, since most officers and farmers work from a phone.
 */
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_SYSTEM_ADMIN_PASSWORD;
const ROLES: Array<{ role: string; email: string; password?: string }> = [
  { role: 'officer', email: SEEDED.officerNakuru },
  { role: 'manager', email: SEEDED.managerNakuru.email },
  { role: 'farmer', email: JOURNEY.farmer.email },
  ...(adminPassword ? [{ role: 'admin', email: process.env.E2E_ADMIN_EMAIL ?? E2E_SYSTEM_ADMIN.email, password: adminPassword }] : []),
];
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 740 };

async function accessibilityProblems(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Map tiles and canvases are drawn by third-party libraries outside our markup.
    .exclude('.leaflet-container')
    .analyze();
  return result.violations
    .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    .map(violation => `${violation.id} (${violation.impact}): ${violation.help}; e.g. ${violation.nodes[0]?.html.slice(0, 160) ?? ''}`);
}

/** Elements that push the page wider than the phone screen, by their tag and class. */
async function overflowProblems(page: Page): Promise<string[]> {
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(400);
  const wide = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= limit + 1) return [] as string[];
    return Array.from(document.querySelectorAll('main *'))
      .filter(node => {
        const box = (node as HTMLElement).getBoundingClientRect();
        return box.width > 0 && box.right > limit + 1 && getComputedStyle(node).position !== 'fixed';
      })
      .slice(0, 3)
      .map(node => `${node.tagName.toLowerCase()}.${String((node as HTMLElement).className).split(' ').slice(0, 4).join('.')}`);
  });
  await page.setViewportSize(DESKTOP);
  return wide.map(where => `wider than a phone screen: ${where}`);
}

for (const { role, email, password } of ROLES) {
  test(`every ${role} page is accessible and fits a phone`, async ({ browser }, testInfo) => {
    test.setTimeout(480_000);
    const { context, page } = await signedIn(browser, email, password);
    await page.setViewportSize(DESKTOP);
    const report: string[] = [];
    for (const item of await menuItems(page)) {
      await openItem(page, item);
      const problems = [...(await accessibilityProblems(page)), ...(await overflowProblems(page))];
      if (problems.length) report.push(`${item.section} › ${item.label}\n    ${problems.join('\n    ')}`);
    }
    await context.close();
    await testInfo.attach(`${role}-usability-problems.txt`, { body: report.join('\n') || 'none', contentType: 'text/plain' });
    expectNoProblems(`${role} pages`, report);
  });
}
