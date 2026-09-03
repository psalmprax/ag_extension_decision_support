/**
 * Discovery Scraper Service (plain ESM JavaScript — no TypeScript syntax).
 *
 * Contract consumed by tools/cloakbrowser/cloak_scanner.py:
 *   GET /scrape/web?url=<page>&niche=<q>&region=<r>&max_results=<n>[&wait_selector=<css>][&scroll=true][&platform=<name>]
 *   -> { success: true, candidates: [{ id, url, title, description, author, thumbnail, views }] }
 *   GET /health -> { success: true }
 */
import express from 'express';
import puppeteer from 'puppeteer-core';

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 8010);
const NAV_TIMEOUT_MS = Number(process.env.SCRAPE_NAV_TIMEOUT_MS || 30000);
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
  });
  return browser;
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight || total > 6000) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
    });
  });
}

/**
 * Extract result-like items from a page. If a container selector is provided we
 * treat each match as one result; otherwise we harvest prominent anchors.
 */
import { extractCandidatesFromDocument } from './extract.js';

/**
 * Extract result-like items from a page. The DOM walk lives in extract.js (pure,
 * unit-tested); here we only serialise it into the page context.
 */
async function extractCandidates(page, { containerSelector, maxResults, pageUrl }) {
  return page.evaluate(
    (fnSource, args) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${fnSource})`)();
      return fn(document, args);
    },
    extractCandidatesFromDocument.toString(),
    { containerSelector, maxResults, pageUrl }
  );
}

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'discovery-scraper', browser: Boolean(browser && browser.connected), timestamp: new Date().toISOString() });
});

async function scrapeHandler(req, res) {
  const params = { ...req.query, ...(req.body || {}) };
  const url = String(params.url || '');
  const maxResults = Math.min(Math.max(parseInt(String(params.max_results || '10'), 10) || 10, 1), 50);
  const waitSelector = params.wait_selector ? String(params.wait_selector) : null;
  const scroll = String(params.scroll || '') === 'true';

  if (!isHttpUrl(url)) {
    return res.status(400).json({ success: false, error: 'url must be an absolute http(s) URL', candidates: [] });
  }

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });

    if (waitSelector) {
      try { await page.waitForSelector(waitSelector, { timeout: 10000 }); } catch { /* proceed without */ }
    }
    if (scroll) await autoScroll(page);

    const candidates = await extractCandidates(page, { containerSelector: waitSelector, maxResults, pageUrl: url });
    const title = await page.title();

    res.json({
      success: true,
      url,
      pageTitle: title,
      platform: params.platform ? String(params.platform) : 'web',
      niche: params.niche ? String(params.niche) : '',
      region: params.region ? String(params.region) : '',
      count: candidates.length,
      candidates,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(502).json({ success: false, error: error && error.message ? error.message : 'Scraping failed', candidates: [] });
  } finally {
    if (page) { try { await page.close(); } catch { /* ignore */ } }
  }
}

// Endpoint the Python scanner calls (GET with query params); POST also accepted.
app.get('/scrape/web', scrapeHandler);
app.post('/scrape/web', scrapeHandler);
app.post('/scrape', scrapeHandler);

async function start() {
  try {
    await getBrowser();
    console.log('Browser initialized');
  } catch (err) {
    // Serve /health so orchestration can see the container, but report the failure.
    console.error('Browser launch failed at startup (will retry per request):', err && err.message ? err.message : err);
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Discovery scraper listening on :${PORT}`));
}

async function shutdown(signal) {
  console.log(`${signal} received, closing browser...`);
  try { if (browser) await browser.close(); } catch { /* ignore */ }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
