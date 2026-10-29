#!/usr/bin/env node
/**
 * Capture the figures used by docs/USER_MANUAL.md.
 *
 * Runs against an already-running frontend (default http://localhost:5173) and
 * writes PNGs into docs/manual/figures/. Each figure gets numbered pins injected
 * over real elements, so the callouts in the manual point at the actual control
 * rather than at a hand-drawn approximation.
 *
 * Usage:
 *   npm run dev            # in ag-extension-dashboard/src/frontend
 *   node scripts/capture_manual_screenshots.cjs [baseUrl]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.argv[2] || process.env.MANUAL_BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'manual', 'figures');

/**
 * Pin definitions: a CSS selector plus the caption text the manual legend uses.
 * Selectors are resolved in page order; the number is the pin label.
 */
const FIGURES = [
  {
    name: 'login',
    route: '/login',
    viewport: { width: 1440, height: 900 },
    waitFor: '#login-email',
    pins: [
      { selector: '#login-email', label: '1' },
      { selector: '#login-password', label: '2' },
      { selector: 'button[type="submit"]', label: '3' },
      { selector: 'a[href="/forgot-password"], a[href*="forgot"]', label: '4', anchor: 'center' },
      { selector: 'a[href="/register"], a[href*="register"]', label: '5', anchor: 'center' },
    ],
  },
  {
    name: 'register',
    route: '/register',
    viewport: { width: 1440, height: 1000 },
    waitFor: 'form',
    pins: [
      { selector: 'input[type="text"]', label: '1' },
      { selector: 'input[type="email"]', label: '2' },
      { selector: 'input[type="password"]', label: '3' },
      { selector: 'select', label: '4' },
      { selector: 'button[type="submit"]', label: '5' },
    ],
  },
];

function pinStyle(left, top, label) {
  return [
    'position:absolute',
    `left:${left}px`,
    `top:${top}px`,
    'width:26px',
    'height:26px',
    'margin:-13px 0 0 -13px',
    'border-radius:9999px',
    'background:#166534',
    'color:#ffffff',
    'font:700 13px/26px Helvetica,Arial,sans-serif',
    'text-align:center',
    'box-shadow:0 0 0 3px #dcfce7',
    'z-index:2147483647',
    'pointer-events:none',
  ].join(';');
}

async function capture(browser, figure) {
  const page = await browser.newPage({ viewport: figure.viewport, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}${figure.route}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector(figure.waitFor, { timeout: 20000 });
  // Let fonts and entrance animations settle before measuring positions.
  await page.waitForTimeout(1200);

  const placed = [];
  for (const pin of figure.pins) {
    const locator = page.locator(pin.selector).first();
    const count = await locator.count();
    if (!count) {
      console.warn(`  [${figure.name}] selector not found: ${pin.selector}`);
      continue;
    }
    const box = await locator.boundingBox();
    if (!box) {
      console.warn(`  [${figure.name}] element not visible: ${pin.selector}`);
      continue;
    }
    const x = Math.round(pin.anchor === 'center' ? box.x + box.width / 2 : box.x + 16);
    const y = Math.round(box.y + box.height / 2);
    await page.evaluate(
      ({ x, y, label, style }) => {
        const marker = document.createElement('div');
        marker.textContent = label;
        marker.setAttribute('data-manual-callout', label);
        marker.style.cssText = style;
        document.body.appendChild(marker);
        marker.style.left = `${document.documentElement.scrollLeft + x}px`;
        marker.style.top = `${document.documentElement.scrollTop + y}px`;
      },
      { x, y, label: pin.label, style: pinStyle(x, y, pin.label) }
    );
    placed.push(pin.label);
  }

  const file = path.join(OUT_DIR, `${figure.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await page.close();
  console.log(`  ${path.relative(path.join(__dirname, '..'), file)} (pins: ${placed.join(', ') || 'none'})`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const figure of FIGURES) {
      process.stdout.write(`Capturing ${figure.name}...\n`);
      await capture(browser, figure);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
