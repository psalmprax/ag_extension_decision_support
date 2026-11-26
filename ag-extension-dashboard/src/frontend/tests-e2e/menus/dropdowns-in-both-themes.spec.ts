import { test } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { E2E_SYSTEM_ADMIN, JOURNEY, signedIn } from '../helpers/journey';
import { dropdownProblems, setTheme, sortFindings, type Theme } from '../helpers/dropdownContrast';
import { expectNoProblems, menuItems, openItem } from './honesty';

/**
 * Every dropdown switches with the theme: in light mode and in dark mode, the closed
 * control, the list a native <select> opens and the items of a custom dropdown are all
 * readable on the background they are actually drawn on. A dropdown styled for one theme
 * only (white text on a list that turns white, or a fixed dark list in light mode) fails.
 */
const THEMES: Theme[] = ['light', 'dark'];
const PUBLIC_PAGES = ['/', '/login', '/register'];
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_SYSTEM_ADMIN_PASSWORD;
const ROLES: Array<{ role: string; email: string; password?: string }> = [
  { role: 'officer', email: SEEDED.officerNakuru },
  { role: 'manager', email: SEEDED.managerNakuru.email },
  { role: 'farmer', email: JOURNEY.farmer.email },
  ...(adminPassword ? [{ role: 'admin', email: process.env.E2E_ADMIN_EMAIL ?? E2E_SYSTEM_ADMIN.email, password: adminPassword }] : []),
];

test('dropdowns on the public pages are readable in light and dark mode', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/');
  const report: string[] = [];
  const unmeasured: string[] = [];
  for (const theme of THEMES) {
    await setTheme(page, theme);
    const seen = new Set<string>();
    for (const path of PUBLIC_PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' }).catch(() => undefined);
      // The landing page's voice assistant keeps its language picker in a panel that only
      // exists once the assistant is opened.
      const assistant = page.getByRole('button', { name: 'Open agronomic assistant' });
      if (path === '/' && (await assistant.isVisible())) await assistant.click();
      const { problems, notMeasured } = sortFindings(await dropdownProblems(page, seen));
      if (problems.length) report.push(`${theme} ${path}\n    ${problems.join('\n    ')}`);
      if (notMeasured.length) unmeasured.push(`${theme} ${path}\n    ${notMeasured.join('\n    ')}`);
    }
  }
  await testInfo.attach('public-dropdown-problems.txt', { body: report.join('\n') || 'none', contentType: 'text/plain' });
  await testInfo.attach('public-dropdown-not-measured.txt', { body: unmeasured.join('\n') || 'none', contentType: 'text/plain' });
  expectNoProblems('public pages', report);
});

for (const { role, email, password } of ROLES) {
  test(`every ${role} dropdown is readable in light and dark mode`, async ({ browser }, testInfo) => {
    test.setTimeout(600_000);
    const { context, page } = await signedIn(browser, email, password);
    const report: string[] = [];
    const unmeasured: string[] = [];
    for (const theme of THEMES) {
      await setTheme(page, theme);
      const seen = new Set<string>();
      for (const item of await menuItems(page)) {
        await openItem(page, item);
        const { problems, notMeasured } = sortFindings(await dropdownProblems(page, seen));
        const where = `${theme} ${item.section} › ${item.label}`;
        if (problems.length) report.push(`${where}\n    ${problems.join('\n    ')}`);
        if (notMeasured.length) unmeasured.push(`${where}\n    ${notMeasured.join('\n    ')}`);
      }
    }
    await context.close();
    await testInfo.attach(`${role}-dropdown-problems.txt`, { body: report.join('\n') || 'none', contentType: 'text/plain' });
    await testInfo.attach(`${role}-dropdown-not-measured.txt`, { body: unmeasured.join('\n') || 'none', contentType: 'text/plain' });
    expectNoProblems(`${role} dropdowns`, report);
  });
}
