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

async function openKnowledgeBase(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Try the Demo' }).click({ timeout: 90000 });
  await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 30000 });
  await page.goto('/knowledge');
  await expect(page.locator('input[placeholder*="Ask ALFA Agro-RAG"]')).toBeVisible({ timeout: 15000 });
}

async function submitQuery(page: Page, query = 'Maize Fall Armyworm IPM control') {
  await page.locator('input[placeholder*="Ask ALFA Agro-RAG"]').fill(query);
  const bypassBtn = page.locator('button:has-text("Bypass"), button:has-text("Bypass & Ask General")');
  if (await bypassBtn.isVisible()) {
    await bypassBtn.click();
  } else {
    await page.getByRole('button', { name: 'Search RAG' }).click();
  }
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
            answer:
              '### Verified Agro-RAG Synthesis: Fall Armyworm IPM\n\n' +
              '**Action Thresholds:** Apply Bacillus thuringiensis (Bt) or Spinetoram when 20% of whorls in vegetative stage show leaf skeletonization.\n\n' +
              '**Biological & Cultural Controls:** Monitor maize whorls and use locally approved biological controls.',
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

    await openKnowledgeBase(page);
    await submitQuery(page, 'What are the biological control thresholds for Fall Armyworm in maize?');

    // Verify Grounded Synthesis result renders
    await expect(page.getByText('Grounded Synthesis Completed')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Verified Agro-RAG Synthesis', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Action Thresholds', { exact: false })).toBeVisible();
    await expect(page.getByText('Biological & Cultural Controls', { exact: false })).toBeVisible();
  });

  test('renders an honest no-answer state when backend returns 502/error', async ({
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

    await openKnowledgeBase(page);
    await submitQuery(page);

    // A failed request must not be presented as a grounded or fabricated answer.
    await expect(page.getByText('Search Failed — No Answer Generated')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('The knowledge search failed, so no answer was produced', { exact: false }))
      .toBeVisible();
    await expect(page.getByText('Verified Agro-RAG Synthesis', { exact: false })).toHaveCount(0);
  });

  for (const [label, body] of [
    ['empty answer', { success: true, data: { answer: '   ', contextUsed: [], citations: [] } }],
    ['missing data', { success: true }],
    ['invalid answer', { success: true, data: { answer: 42 } }],
    ['application error', { success: false, error: 'Search unavailable' }],
    ['unavailable answer', { success: true, data: { answer: 'Unavailable', answerMode: 'unavailable' } }],
  ] as const) {
    test(`rejects ${label} without claiming a grounded synthesis`, async ({ page }) => {
      await mockDemoBackend(page);
      await page.route(url => url.pathname === '/api/knowledge/ask', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await openKnowledgeBase(page);
      await submitQuery(page);

      await expect(page.getByText('Search Failed — No Answer Generated')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Grounded Synthesis Completed')).toHaveCount(0);
    });
  }

  for (const [answerMode, evidenceStatus, heading] of [
    ['extractive', 'verified_sources', 'Source Excerpts — AI Synthesis Unavailable'],
    ['generated', 'no_verified_source', 'General Guidance — Not Verified'],
  ] as const) {
    test(`labels ${answerMode} responses without overstating evidence`, async ({ page }) => {
      await mockDemoBackend(page);
      await page.route(url => url.pathname === '/api/knowledge/ask', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { answer: 'Scout maize fields.', answerMode, evidenceStatus, contextUsed: [], citations: [] },
          }),
        });
      });
      await openKnowledgeBase(page);
      await submitQuery(page);

      await expect(page.getByText(heading)).toBeVisible();
      await expect(page.getByText('Grounded Synthesis Completed')).toHaveCount(0);
    });
  }

  test('clears a stale answer on failure and successfully retries with cache bypass', async ({ page }) => {
    await mockDemoBackend(page);
    let requests = 0;
    await page.route(url => url.pathname === '/api/knowledge/ask', async route => {
      requests++;
      if (requests === 2) {
        await route.fulfill({
          status: 503, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Assistant unavailable' }),
        });
        return;
      }
      if (requests === 3) expect(route.request().postDataJSON().bypassCache).toBe(true);
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            answer: 'Scout maize fields before treatment.', answerMode: 'generated',
            evidenceStatus: 'no_verified_source', contextUsed: [], citations: [],
          },
        }),
      });
    });
    await openKnowledgeBase(page);
    await submitQuery(page);
    await expect(page.getByText('Scout maize fields before treatment.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Regenerate Live' }).click();
    await expect(page.getByText('Search Failed — No Answer Generated')).toBeVisible();
    await expect(page.getByText('Scout maize fields before treatment.', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Regenerate Live' }).click();
    await expect(page.getByText('Scout maize fields before treatment.', { exact: true })).toBeVisible();
    await expect(page.getByText('Search Failed — No Answer Generated')).toHaveCount(0);
    expect(requests).toBe(3);
  });

  test('retains failed search attachments and resubmits them on retry', async ({ page }) => {
    await mockDemoBackend(page);
    const bodies: Array<{ attachments: unknown[]; bypassCache?: boolean }> = [];
    await page.route(url => url.pathname === '/api/knowledge/ask', async route => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) {
        await route.fulfill({
          status: 503, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Assistant unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { answer: 'Check the field notes with your officer.', contextUsed: [], evidenceStatus: 'no_verified_source' },
        }),
      });
    });
    await openKnowledgeBase(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'field-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Maize leaf observations'),
    });
    await expect(page.getByText('field-notes.txt', { exact: true })).toBeVisible();
    await submitQuery(page);
    await expect(page.getByText('Search Failed — No Answer Generated')).toBeVisible();
    await expect(page.getByText('field-notes.txt', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Regenerate Live' }).click();
    await expect(page.getByText('Check the field notes with your officer.', { exact: true })).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[0].attachments).toHaveLength(1);
    expect(bodies[1]).toMatchObject({ attachments: bodies[0].attachments, bypassCache: true });
    await expect(page.getByText('field-notes.txt', { exact: true })).toHaveCount(0);
  });
});
