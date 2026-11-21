import { test } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { E2E_SYSTEM_ADMIN, JOURNEY, signedIn } from '../helpers/journey';
import { expectNoProblems, menuItems, openItem, tabProblems, textProblems, watchApi } from './honesty';

/**
 * Every page in every role's menu, opened as a real user on real data. A page passes when
 * its requests all succeed and it shows nothing a stub or an unfinished page would:
 * placeholders, broken values, inflated copy, emoji icons or shouted labels.
 * Each tab of a page is opened too. One run lists everything that needs fixing.
 */
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_SYSTEM_ADMIN_PASSWORD;
const ROLES: Array<{ role: string; email: string; password?: string }> = [
  { role: 'officer', email: SEEDED.officerNakuru },
  { role: 'manager', email: SEEDED.managerNakuru.email },
  { role: 'farmer', email: JOURNEY.farmer.email },
  // The run's temporary system administrator (or E2E_ADMIN_EMAIL locally).
  ...(adminPassword ? [{ role: 'admin', email: process.env.E2E_ADMIN_EMAIL ?? E2E_SYSTEM_ADMIN.email, password: adminPassword }] : []),
];

for (const { role, email, password } of ROLES) {
  test.describe(`every ${role} menu page is real and honest`, () => {
    test.setTimeout(480_000);

    test(`${role}: each page loads without failed requests or stub content`, async ({ browser }, testInfo) => {
      const { context, page } = await signedIn(browser, email, password);
      const api = watchApi(page);
      const report: string[] = [];
      const outages = new Set<string>();
      for (const item of await menuItems(page)) {
        api.reset();
        await openItem(page, item);
        api.unavailable.forEach(line => outages.add(line));
        const problems = [...api.failures.map(f => `request failed: ${f}`), ...(await textProblems(page)), ...(await tabProblems(page, api))];
        if (problems.length) report.push(`${item.section} › ${item.label}\n    ${problems.join('\n    ')}`);
      }
      api.stop();
      await context.close();
      await testInfo.attach(`${role}-menu-problems.txt`, { body: report.join('\n') || 'none', contentType: 'text/plain' });
      // Not a failure of the page, but worth seeing: which outside services were down.
      await testInfo.attach(`${role}-services-unavailable.txt`, { body: [...outages].join('\n') || 'none', contentType: 'text/plain' });
      expectNoProblems(`${role} menu pages`, report);
    });
  });
}
