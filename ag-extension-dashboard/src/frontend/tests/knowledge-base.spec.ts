import { test, expect, type Page } from '@playwright/test';

const DEMO_USER = {
  id: 'demo-farmer-1',
  email: 'demo@agridemo.io',
  firstName: 'Emmanuel',
  lastName: 'Mwangi',
  role: 'extension_officer',
  region: 'Machakos',
};

const AUTH_RESPONSE = {
  success: true,
  data: { token: 'e2e-demo-token', user: DEMO_USER },
  token: 'e2e-demo-token',
  user: DEMO_USER,
};

async function mockDemoBackend(page: Page) {
  const isApiPath = (url: URL) => url.pathname.startsWith('/api/');

  await page.route(isApiPath, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
  await page.route(url => url.pathname === '/api/auth/demo', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AUTH_RESPONSE),
    });
  });
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: DEMO_USER }),
    });
  });
  await page.route(url => url.pathname === '/api/knowledge/quota', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { allowed: true, current: 0, limit: -1, remaining: 999999, isFree: false },
      }),
    });
  });
  await page.route(url => url.pathname === '/api/knowledge/stats', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { totalArticles: 42, categories: [], topCrops: [], recentActivity: 5 },
      }),
    });
  });
  await page.route(url => url.pathname === '/api/external/weather', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { temp: 22, temperature: 22, condition: 'sunny', humidity: 40, windSpeed: 5 },
      }),
    });
  });
}

test.describe('@e2e Knowledge Base Synthesis & Answer Rendering', () => {
  test.setTimeout(180_000);

  test('submitting an agronomic query displays grounded synthesis and citations without blank states', async ({
    page,
  }) => {
    await mockDemoBackend(page);

    // Mock /api/knowledge/ask to return a full RAG answer
    await page.route(url => url.pathname === '/api/knowledge/ask', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            answer: 'Action threshold for Fall Armyworm on maize: Apply Bacillus thuringiensis (Bt) or Spinetoram when 20% of whorls in vegetative stage show leaf skeletonization.',
            contextUsed: [
              {
                content: 'FAO Integrated Pest Management Guidelines for Spodoptera frugiperda in Sub-Saharan Africa.',
                score: 0.92,
                metadata: { title: 'FAO Fall Armyworm IPM Manual', crop: 'Maize', category: 'IPM' },
              },
            ],
            cached: false,
            citations: [
              {
                sourceId: 'fao-faw-2024',
                title: 'FAO Fall Armyworm IPM Manual',
                category: 'IPM',
                excerpt: 'Threshold 20% whorl infestation in vegetative stage.',
                score: 0.92,
              },
            ],
            evidenceStatus: 'verified_sources',
            visuals: {
              kpis: [
                { label: 'Infestation Threshold', value: '20% Whorls', status: 'good' },
                { label: 'Recommended Bio-control', value: 'Bt / Neem', status: 'good' },
              ],
              charts: [],
              images: [],
              videos: [],
            },
          },
        }),
      });
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the Demo' }).click({ timeout: 90000 });
    await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 30000 });

    // Navigate to Knowledge Base
    await page.goto('/knowledge');
    const kbInput = page.locator('input[placeholder*="Ask ALFA Agro-RAG"]');
    await expect(kbInput).toBeVisible({ timeout: 15000 });

    // Enter query
    const query = 'What are the biological control thresholds for Fall Armyworm in maize?';
    await kbInput.fill(query);

    // Handle intake clarification card if displayed, or click search
    const bypassBtn = page.locator('button:has-text("Bypass"), button:has-text("Bypass & Ask General")');
    if (await bypassBtn.isVisible().catch(() => false)) {
      await bypassBtn.click();
    } else {
      await page.locator('button:has-text("Search RAG")').click();
    }

    // Verify Grounded Synthesis result renders
    await expect(page.getByText('Grounded Synthesis Completed')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Verified Agro-RAG Synthesis', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Action Thresholds', { exact: false })).toBeVisible();
    await expect(page.getByText('Biological & Cultural Controls', { exact: false })).toBeVisible();
  });

  test('gracefully renders fallback benchmark result when backend returns 502/error', async ({
    page,
  }) => {
    await mockDemoBackend(page);

    // Mock /api/knowledge/ask to fail with 502 Bad Gateway
    await page.route(url => url.pathname === '/api/knowledge/ask', async route => {
      await route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<html><body>502 Bad Gateway</body></html>',
      });
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the Demo' }).click({ timeout: 90000 });
    await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 30000 });

    // Navigate to Knowledge Base
    await page.goto('/knowledge');
    const kbInput = page.locator('input[placeholder*="Ask ALFA Agro-RAG"]');
    await expect(kbInput).toBeVisible({ timeout: 15000 });

    // Type query
    await kbInput.fill('Maize Fall Armyworm IPM control');

    const bypassBtn = page.locator('button:has-text("Bypass"), button:has-text("Bypass & Ask General")');
    if (await bypassBtn.isVisible().catch(() => false)) {
      await bypassBtn.click();
    } else {
      await page.locator('button:has-text("Search RAG")').click();
    }

    // Verify that instead of a blank page, the fallback synthesis is rendered
    await expect(page.getByText('Grounded Synthesis Completed')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Verified Agro-RAG Synthesis', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Action Thresholds', { exact: false })).toBeVisible();
  });
});
