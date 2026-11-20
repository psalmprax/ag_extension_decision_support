import { expect, type Page, type Response } from '@playwright/test';

/**
 * What a page must never show a real user: placeholders, broken values, inflated
 * marketing copy, emoji used as icons, or shouted all-caps labels. These are the tells
 * of a stub or a page nobody finished.
 */
const PLACEHOLDERS = /\b(lorem ipsum|todo|fixme|coming soon|placeholder|dummy data|mock data|sample data|not implemented)\b/i;
const BROKEN_VALUES = /\bNaN\b|\bundefined\b|\[object Object\]|Invalid Date|\{\{\s*\w+\s*\}\}/;
const HYPE =
  /\b(revolutionary|supercharge[ds]?|game[- ]changing|cutting[- ]edge|next[- ]gen(eration)?|seamless(ly)?|neural \w+|state[- ]of[- ]the[- ]art|world[- ]class|powered by|\w+ engine( ready)?|fleet ops|unleash\w*|co-?pilot studio|zero-code|multi-modal|synthesi[sz]ing|viewfinder|loupe lens)\b/i;
/** Emoji and pictographs (not plain symbols like °, ±, ·, or the © in map credits). */
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;
/** Acronyms that are written in capitals anyway. */
const ACRONYMS = new Set([
  'SMS', 'USSD', 'CSV', 'NDVI', 'AI', 'API', 'FAO', 'KES', 'USD', 'MWK', 'PDF', 'MIS', 'GPS', 'ID', 'PIN', 'URL', 'ISRIC', 'FAOSTAT',
  'GIEWS', 'FX', 'NASA', 'POWER', 'MCP', 'RAG', 'PWA', 'OK', 'EN', 'SW', 'NY', 'UTC', 'EAT', 'CAN', 'DAP', 'NPK', 'IPM', 'PHI', 'REI',
  'TOTP', 'CIMMYT', 'MFA', 'SSO', 'CPU', 'RAM', 'DB', 'HTTP', 'JSON', 'WFP', 'FEWS', 'NET', 'USDA', 'FAS', 'PSD', 'OTP', 'VAT', 'GDPR', 'II', 'III',
]);

/**
 * Shouted labels: a capitalised word of four or more letters that is not an acronym
 * (e.g. "HEALTHY", "DAILY QUOTA"). Sentence case is the rule for every label.
 */
export function shoutedRuns(text: string): string[] {
  const shouted = new Set<string>();
  for (const word of text.split(/[\s·|/:,()]+/)) {
    const bare = word.replace(/[^A-Za-z]/g, '');
    if (bare.length >= 4 && bare === bare.toUpperCase() && !ACRONYMS.has(bare)) shouted.add(bare);
  }
  return [...shouted];
}

/** Everything wrong with the visible text of the page, one line per problem. */
export async function textProblems(page: Page): Promise<string[]> {
  // Left out: text to type exactly (<code>, <kbd>: SMS keywords such as INBOX) and the
  // words of messages people sent or received ([data-message]). Neither is the app's copy.
  const text = await page.evaluate(() => {
    const root = document.querySelector('main') ?? document.body;
    let visible = root.innerText;
    for (const node of root.querySelectorAll<HTMLElement>('code, kbd, [data-message]')) visible = visible.replace(node.innerText, ' ');
    return visible;
  });
  const problems: string[] = [];
  const hit = (label: string, pattern: RegExp) => {
    const match = pattern.exec(text);
    if (match) problems.push(`${label}: "${text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30).replace(/\s+/g, ' ')}"`);
  };
  hit('placeholder', PLACEHOLDERS);
  hit('broken value', BROKEN_VALUES);
  hit('inflated copy', HYPE);
  hit('emoji', EMOJI);
  for (const run of shoutedRuns(text)) {
    const at = text.indexOf(run);
    problems.push(`all caps: "${run}" in "${text.slice(Math.max(0, at - 30), at + run.length + 30).replace(/\s+/g, ' ')}"`);
  }
  return problems;
}

/**
 * Records API calls that failed while a page was open: server errors, refusals and missing
 * routes. A 503 is kept apart: it is the server saying plainly that an outside service
 * (weather, the AI provider) is down, which a page may meet and must then explain.
 */
export function watchApi(page: Page) {
  const failures: string[] = [];
  const unavailable: string[] = [];
  const onResponse = (response: Response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/')) return;
    const status = response.status();
    const line = `${response.request().method()} ${url.pathname} ${status}`;
    if (status === 503) unavailable.push(line);
    else if (status >= 500 || status === 403 || status === 404) failures.push(line);
  };
  page.on('response', onResponse);
  return {
    failures,
    unavailable,
    reset: () => {
      failures.splice(0);
      unavailable.splice(0);
    },
    stop: () => page.off('response', onResponse),
  };
}

/** Every item in the side menu, after opening every section. */
export async function menuItems(page: Page): Promise<Array<{ section: string; label: string }>> {
  const toggles = page.locator('nav button[aria-controls^="sidebar-section-"]');
  await toggles.first().waitFor({ timeout: 30_000 });
  const items: Array<{ section: string; label: string }> = [];
  for (let i = 0; i < (await toggles.count()); i++) {
    const toggle = toggles.nth(i);
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    const section = (await toggle.innerText()).trim();
    const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
    for (const label of await panel.locator(':scope > button').allInnerTexts()) {
      items.push({ section, label: label.split('\n')[0].trim() });
    }
  }
  return items;
}

/** Opens a menu item by section and label and waits for the page to settle. */
export async function openItem(page: Page, item: { section: string; label: string }): Promise<void> {
  const toggle = page.locator('nav button[aria-controls^="sidebar-section-"]', { hasText: item.section }).first();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
  await panel.locator(':scope > button', { hasText: item.label }).first().click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

/** Fails with every problem listed, so one run shows the whole worklist for a page. */
export function expectNoProblems(where: string, problems: string[]): void {
  expect(problems, `${where}:\n  ${problems.join('\n  ')}`).toEqual([]);
}
