import { test, type Page, type ConsoleMessage } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Live menu audit: signs in as each role on a deployed environment, opens
 * every left-menu item and records what the page actually did. It only clicks
 * sidebar section toggles and menu items, never page controls, so it cannot
 * send, pay for or delete anything.
 *
 * Env: AUDIT_BASE_URL, AUDIT_PASSWORD, AUDIT_<ROLE>_EMAIL (ADMIN, OFFICER, FARMER),
 *      AUDIT_OUT (output directory, default ui-audit).
 */

interface ApiFailure { method: string; path: string; status: number; body: string }
interface PageReport {
  role: string;
  section: string;
  label: string;
  order: number;
  loadMs: number;
  errorBoundary: string | null;
  planLocked: boolean;
  stuckLoading: boolean;
  apiFailures: ApiFailure[];
  requestFailures: string[];
  consoleErrors: string[];
  pageErrors: string[];
  menuObstructed: string | null;
  headings: string[];
  text: string;
  screenshot: string;
}

const OUT = process.env.AUDIT_OUT || 'ui-audit';
const PASSWORD = process.env.AUDIT_PASSWORD || '';
const ACCOUNTS = [
  { role: 'admin', email: process.env.AUDIT_ADMIN_EMAIL },
  { role: 'extension_officer', email: process.env.AUDIT_OFFICER_EMAIL },
  { role: 'farmer', email: process.env.AUDIT_FARMER_EMAIL },
].filter((a): a is { role: string; email: string } => Boolean(a.email));

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Close tours, banners and dialogs that would cover the sidebar. */
async function dismissOverlays(page: Page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  for (const name of [/^(skip|skip tour|close|dismiss|not now|got it|maybe later|accept)$/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible().catch(() => false)) await button.click({ timeout: 2000 }).catch(() => undefined);
  }
}

async function signIn(page: Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.locator('nav').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await dismissOverlays(page);
}

/** Every menu item in the sidebar, after expanding every section. */
async function menuItems(page: Page): Promise<Array<{ section: string; label: string }>> {
  const toggles = page.locator('nav button[aria-controls^="sidebar-section-"]');
  const items: Array<{ section: string; label: string }> = [];
  for (let i = 0; i < await toggles.count(); i++) {
    const toggle = toggles.nth(i);
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    const section = (await toggle.innerText()).trim();
    const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
    for (const label of await panel.locator(':scope > button').allInnerTexts()) {
      items.push({ section, label: label.trim() });
    }
  }
  return items;
}

/**
 * Opens a menu item like a user would. If something covers it (a tour, a
 * floating widget), that is recorded and the item is opened directly so the
 * page itself still gets audited. Returns the obstruction, if any.
 */
async function openItem(page: Page, item: { section: string; label: string }): Promise<string | null> {
  const toggle = page.locator('nav button[aria-controls^="sidebar-section-"]', { hasText: item.section }).first();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
  const button = panel.locator(':scope > button', { hasText: item.label }).first();
  try {
    await button.click({ timeout: 10_000 });
    return null;
  } catch (error) {
    const reason = (error as Error).message.match(/<[^>]+> (?:from <[^>]+> )?subtree intercepts pointer events/)?.[0]
      ?? (error as Error).message.split('\n')[0];
    await button.dispatchEvent('click');
    return clip(reason, 200);
  }
}

for (const account of ACCOUNTS) {
  test(`menu audit as ${account.role}`, async ({ page }) => {
    test.setTimeout(25 * 60_000);
    const reports: PageReport[] = [];
    let current: { api: ApiFailure[]; failed: string[]; console: string[]; errors: string[] } = { api: [], failed: [], console: [], errors: [] };

    page.on('response', async response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/') || response.status() < 400) return;
      const body = await response.text().catch(() => '');
      current.api.push({ method: response.request().method(), path: url.pathname + url.search, status: response.status(), body: clip(body.replace(/\s+/g, ' '), 240) });
    });
    page.on('requestfailed', request => {
      const url = new URL(request.url());
      if (url.hostname === new URL(page.url() || 'http://x').hostname) current.failed.push(`${request.method()} ${url.pathname} ${request.failure()?.errorText ?? ''}`);
    });
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error') current.console.push(clip(message.text().replace(/\s+/g, ' '), 300));
    });
    page.on('pageerror', error => current.errors.push(clip(error.message, 300)));

    const dir = path.join(OUT, account.role);
    fs.mkdirSync(dir, { recursive: true });
    const save = () => fs.writeFileSync(path.join(OUT, `${account.role}.json`), JSON.stringify(reports, null, 2));
    await signIn(page, account.email);
    await page.screenshot({ path: path.join(dir, '00-after-sign-in.jpg'), type: 'jpeg', quality: 55 });
    const items = await menuItems(page);
    console.log(`[${account.role}] signed in; ${items.length} menu items`);

    for (const [order, item] of items.entries()) {
      current = { api: [], failed: [], console: [], errors: [] };
      const started = Date.now();
      console.log(`[${account.role}] ${order + 1}/${items.length} ${item.section} › ${item.label}`);
      let obstructed: string | null = null;
      try {
        obstructed = await openItem(page, item);
      } catch (error) {
        current.errors.push(`could not open menu item: ${(error as Error).message.split('\n')[0]}`);
      }
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const main = page.locator('main').first();
      const text = (await main.innerText().catch(() => '')).replace(/\n{2,}/g, '\n').trim();
      const boundary = await page.getByRole('alert').filter({ hasText: 'Something went wrong' }).first().innerText().catch(() => '');
      const spinners = await main.locator('.animate-spin:visible').count().catch(() => 0);
      const file = path.join(dir, `${String(order + 1).padStart(2, '0')}-${slug(item.label)}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 55, fullPage: true, timeout: 20_000 })
        .catch(() => page.screenshot({ path: file, type: 'jpeg', quality: 55, timeout: 10_000 }).catch(() => undefined));
      reports.push({
        role: account.role,
        section: item.section,
        label: item.label,
        order: order + 1,
        loadMs: Date.now() - started,
        errorBoundary: boundary ? clip(boundary.replace(/\s+/g, ' '), 400) : null,
        planLocked: /Pro Feature Locked/i.test(text),
        stuckLoading: spinners > 0 || /^\s*loading/i.test(text),
        apiFailures: current.api,
        requestFailures: current.failed,
        consoleErrors: current.console,
        pageErrors: current.errors,
        menuObstructed: obstructed,
        headings: (await main.locator('h1, h2, h3').allInnerTexts().catch(() => [])).slice(0, 12).map(h => clip(h.trim(), 80)),
        text: clip(text, 1500),
        screenshot: path.relative(OUT, file),
      });
      save();
      // Recover from a crashed page so the next item is audited on a clean shell.
      if (boundary) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('nav').first().waitFor({ state: 'visible', timeout: 60_000 });
        await dismissOverlays(page);
      }
    }

    save();
  });
}
