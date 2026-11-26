import type { Locator, Page } from '@playwright/test';

/**
 * Checks that every dropdown on a page is readable in the current theme: the closed
 * control, the options of a native <select> (the list the browser opens) and the items
 * of a custom dropdown once it is open. Text must reach WCAG AA contrast against the
 * background it is actually drawn on (4.5:1, or 3:1 for large text and placeholders).
 */

export type Theme = 'light' | 'dark';

/** Switches the app's theme the way the toggle does (it is kept in local storage), and reloads. */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((dark) => {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    const raw = localStorage.getItem('ag-extension-storage');
    if (raw) {
      const saved = JSON.parse(raw) as { state?: Record<string, unknown> };
      saved.state = { ...(saved.state ?? {}), darkMode: dark };
      localStorage.setItem('ag-extension-storage', JSON.stringify(saved));
    }
  }, theme === 'dark');
  await page.reload({ waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForFunction((dark) => document.documentElement.classList.contains('dark') === dark, theme === 'dark', { timeout: 15_000 });
}

// --- Runs in the page ----------------------------------------------------------
// These functions are sent into the page together as source text (see runInPage), so
// they may only use each other and browser globals, never anything else in this file.

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(value: string): RGBA | null {
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: alpha };
  }
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(value);
  if (srgb) return { r: +srgb[1] * 255, g: +srgb[2] * 255, b: +srgb[3] * 255, a: srgb[4] === undefined ? 1 : +srgb[4] };
  return null;
}

/** `top` drawn over an opaque `under`. */
function over(top: RGBA, under: RGBA): RGBA {
  const mix = (a: number, b: number) => a * top.a + b * (1 - top.a);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

function contrastRatio(a: RGBA, b: RGBA): number {
  const luminance = (c: RGBA) => {
    const channel = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The page's own canvas colour, which the browser paints behind everything. */
function canvasColor(): RGBA {
  const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
  return dark ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
}

/** The solid colour behind `el`, through see-through layers; null when a picture is behind it. */
function backgroundOf(el: Element): RGBA | null {
  const layers: RGBA[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const color = parseColor(style.backgroundColor);
    if (!color || (style.backgroundImage !== 'none' && color.a < 1)) return null;
    if (color.a > 0) layers.push(color);
    if (color.a >= 1) break;
  }
  const bottom = layers.length && layers[layers.length - 1].a >= 1 ? (layers.pop() as RGBA) : canvasColor();
  return layers.reverse().reduce((result, layer) => over(layer, result), bottom);
}

function describeElement(el: Element): string {
  const label = el.getAttribute('aria-label') ?? el.getAttribute('name') ?? el.id ?? '';
  return `${el.tagName.toLowerCase()}${label ? `[${label}]` : ''}`;
}

function isShown(el: Element): boolean {
  const box = el.getBoundingClientRect();
  if (box.width <= 1 || box.height <= 1 || el.closest('[aria-hidden="true"]')) return false;
  return (el as HTMLElement).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
}

function minimumFor(style: CSSStyleDeclaration): number {
  const size = parseFloat(style.fontSize);
  return size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
}

/** Adds a problem when text in colour `fgValue` on `bg` is below `min`:1. */
function checkText(problems: string[], subject: string, text: string, fgValue: string, bg: RGBA | null, min: number): void {
  const fg = parseColor(fgValue);
  if (!fg || !bg) return;
  const shown = over(fg, bg);
  const value = contrastRatio(shown, bg);
  if (value >= min) return;
  const css = (c: RGBA) => `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)})`;
  problems.push(`${subject} "${text.slice(0, 40)}": ${value.toFixed(2)}:1 (${css(shown)} on ${css(bg)}), needs ${min}:1`);
}

function ownText(el: Element): string {
  return Array.from(el.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

function checkField(problems: string[], label: string, field: HTMLInputElement | HTMLTextAreaElement): void {
  const bg = backgroundOf(field);
  const subject = `${label} ${describeElement(field)}`;
  if (field.value) checkText(problems, `${subject} typed text`, field.value, getComputedStyle(field).color, bg, 4.5);
  if (field.placeholder) checkText(problems, `${subject} placeholder`, field.placeholder, getComputedStyle(field, '::placeholder').color, bg, 3);
}

/** Every piece of visible text (and any text box) inside `root`, `root` included. */
function checkTextIn(problems: string[], root: Element, label: string): void {
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (!isShown(el)) continue;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      checkField(problems, label, el);
      continue;
    }
    const text = ownText(el);
    if (text) checkText(problems, label, text, getComputedStyle(el).color, backgroundOf(el), minimumFor(getComputedStyle(el)));
  }
}

function checkOptions(problems: string[], select: HTMLSelectElement): void {
  let seeThrough = 0;
  for (const option of Array.from(select.options)) {
    if (option.disabled) continue;
    const style = getComputedStyle(option);
    const background = parseColor(style.backgroundColor);
    if (background && background.a < 1) seeThrough += 1;
    else checkText(problems, `${describeElement(select)} option`, option.text, style.color, background, 4.5);
  }
  if (seeThrough) {
    problems.push(`${describeElement(select)}: ${seeThrough} option(s) with a see-through background, so the open list's colours depend on the browser`);
  }
}

/**
 * Every native select: the closed control where it is on screen, and its options always,
 * since the open list's colours do not depend on whether the select is in a hidden tab.
 */
function measureSelects(): string[] {
  const problems: string[] = [];
  for (const select of Array.from(document.querySelectorAll('select'))) {
    if (select.disabled) continue;
    if (isShown(select)) {
      const style = getComputedStyle(select);
      const chosen = select.selectedOptions[0]?.textContent?.trim() ?? '';
      checkText(problems, `${describeElement(select)} (closed)`, chosen, style.color, backgroundOf(select), minimumFor(style));
    }
    checkOptions(problems, select);
  }
  return problems;
}

/** The text inside every open listbox or menu, and a search box the dropdown focused. */
function measurePopups(): string[] {
  const problems: string[] = [];
  for (const popup of Array.from(document.querySelectorAll('[role="listbox"], [role="menu"]'))) {
    if (isShown(popup) && popup.tagName !== 'SELECT') checkTextIn(problems, popup, `${describeElement(popup)} (open)`);
  }
  const focused = document.activeElement;
  if (focused instanceof HTMLInputElement && isShown(focused)) checkTextIn(problems, focused, 'search box (open)');
  return problems;
}

/** The closed custom dropdown marked with data-dropdown-under-test. */
function measureTrigger(): string[] {
  const problems: string[] = [];
  const trigger = document.querySelector('[data-dropdown-under-test]');
  if (trigger && isShown(trigger)) checkTextIn(problems, trigger, `${describeElement(trigger)} (closed)`);
  return problems;
}

// --- Runs in the test ------------------------------------------------------------

const IN_PAGE = [
  parseColor, over, contrastRatio, canvasColor, backgroundOf, describeElement, isShown, minimumFor,
  checkText, ownText, checkField, checkTextIn, checkOptions, measureSelects, measurePopups, measureTrigger,
].map((fn) => fn.toString()).join('\n');

/**
 * Runs one of the measure* functions in the page. Sent as an expression through the
 * DevTools protocol, which a site's Content-Security-Policy does not apply to.
 */
function runInPage(page: Page, entry: 'measureSelects' | 'measurePopups' | 'measureTrigger'): Promise<string[]> {
  return page.evaluate(`(() => {\n${IN_PAGE}\nreturn ${entry}();\n})()`) as Promise<string[]>;
}

/** Buttons that open a listbox or menu, as opposed to a dialog. */
function dropdownTriggers(page: Page): Locator {
  return page.locator('[aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"], [role="combobox"]:not(input):not(select)');
}

/** Opens one custom dropdown, measures it closed and open, and closes it again. */
async function checkCustomDropdown(page: Page, trigger: Locator, key: string): Promise<string[]> {
  await trigger.evaluate((el) => el.setAttribute('data-dropdown-under-test', ''));
  const problems = (await runInPage(page, 'measureTrigger')).map((line) => `"${key}": ${line}`);
  await trigger.evaluate((el) => el.removeAttribute('data-dropdown-under-test'));
  await trigger.click();
  await page.waitForTimeout(300);
  // Type into a search box the dropdown focused, so the typed text is measured too.
  if (await page.evaluate(() => document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text')) {
    await page.keyboard.type('e');
    await page.waitForTimeout(100);
  }
  problems.push(...(await runInPage(page, 'measurePopups')).map((line) => `opened "${key}": ${line}`));
  await page.keyboard.press('Escape');
  if ((await trigger.getAttribute('aria-expanded')) === 'true') await trigger.click();
  return problems;
}

/**
 * Every dropdown problem on the current page. `seen` holds the triggers already opened
 * (the header's language switcher is on every page), so each is opened once per theme.
 */
export async function dropdownProblems(page: Page, seen: Set<string>): Promise<string[]> {
  const problems = await runInPage(page, 'measureSelects');
  const triggers = dropdownTriggers(page);
  const count = Math.min(await triggers.count(), 12);
  for (let i = 0; i < count; i++) {
    const trigger = triggers.nth(i);
    if (!(await trigger.isVisible()) || !(await trigger.isEnabled())) continue;
    const key = `${(await trigger.getAttribute('aria-label')) ?? ''}|${(await trigger.innerText()).trim().slice(0, 30)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push(...(await checkCustomDropdown(page, trigger, key)));
  }
  return problems;
}
