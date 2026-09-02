/**
 * Discovery Scraper Service
 * HTTP API for stealth web scraping used by CloakBrowser
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8010;

let browser: puppeteer.Browser | null = null;

async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
            ],
        });
    }
    return browser;
}

app.get('/health', (_req, res) => {
    res.json({ success: true, service: 'discovery-scraper', timestamp: new Date().toISOString() });
});

// Generic scrape endpoint
app.post('/scrape', async (req, res) => {
    try {
        const { url, platform, niche, region, max_results, wait_selector, scroll } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'url is required' });
        }

        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();

        // Set realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });

        // Navigate with timeout
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Wait for selector if provided
        if (wait_selector) {
            try {
                await page.waitForSelector(wait_selector, { timeout: 10000 });
            } catch {
                // Selector not found, continue anyway
            }
        }

        // Scroll if requested
        if (scroll === 'true' || scroll === true) {
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
        }

        // Extract content
        const content = await page.content();
        const title = await page.title();

        await page.close();

        // Return structured data
        res.json({
            success: true,
            data: {
                url,
                title,
                html: content,
                platform: platform || 'unknown',
                niche: niche || '',
                region: region || '',
                scrapedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Scrape error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Scraping failed',
        });
    }
});

// Search endpoint for generic search
app.get('/search', async (req, res) => {
    try {
        const { q: query, platform, region, max_results } = req.query;

        if (!query) {
            return res.status(400).json({ success: false, error: 'query parameter (q) is required' });
        }

        // Build search URL based on platform
        let searchUrl: string;
        const encodedQuery = encodeURIComponent(query as string);

        switch (platform) {
            case 'google':
                searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
                break;
            case 'bing':
                searchUrl = `https://www.bing.com/search?q=${encodedQuery}`;
                break;
            case 'duckduckgo':
                searchUrl = `https://duckduckgo.com/html/?q=${encodedQuery}`;
                break;
            default:
                searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
        }

        if (region) {
            searchUrl += `&gl=${region}`;
        }

        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Extract search results
        const results = await page.evaluate((maxResults) => {
            const items: Array<{ title: string; url: string; snippet: string }> = [];
            const selectors = [
                'div.g', // Google
                'li.b_algo', // Bing
                'article.result', // DuckDuckGo
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    if (items.length >= (maxResults || 10)) break;
                    const titleEl = el.querySelector('h3, h2, a[href]');
                    const linkEl = el.querySelector('a[href]');
                    const snippetEl = el.querySelector('div[style*="font-size"], .VwiC3b, .b_caption');

                    if (titleEl && linkEl) {
                        items.push({
                            title: titleEl.textContent?.trim() || '',
                            url: linkEl.getAttribute('href') || '',
                            snippet: snippetEl?.textContent?.trim() || '',
                        });
                    }
                }
                if (items.length >= (maxResults || 10)) break;
            }
            return items.slice(0, maxResults || 10);
        }, parseInt(max_results as string) || 10);

        await page.close();

        res.json({
            success: true,
            candidates: results,
            query,
            platform: platform || 'google',
            region: region || 'us',
            scrapedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
        });
    }
});

async function start() {
    try {
        // Pre-warm browser
        await getBrowser();
        console.log('Browser initialized');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Discovery scraper listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing browser...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing browser...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

start();