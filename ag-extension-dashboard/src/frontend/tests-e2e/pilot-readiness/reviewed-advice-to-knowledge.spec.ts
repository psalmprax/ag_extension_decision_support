import { expect, test } from '@playwright/test';
import { SEEDED } from '../helpers/auth';
import { JOURNEY, apiAs, e2eAdmin, signedIn } from '../helpers/journey';

/**
 * Advice an agronomist has checked becomes part of the knowledge base, so the next farmer
 * with the same question gets a sourced answer. Two people sign off: the manager who
 * approves the advice in the review queue, and a different manager or administrator who
 * approves the document. Until then it answers no one.
 */
const onSharedSite = Boolean(process.env.E2E_BASE_URL);
const RUN = Date.now();
const ADVICE =
  `Scout maize for fall armyworm twice a week from emergence (run ${RUN}): walk a W pattern, check 20 plants at `
  + 'each of five points, and look for window-pane feeding and fresh frass in the funnel. Act when a fifth of plants show fresh damage.';
const TITLE = `Fall armyworm scouting in maize (${RUN})`;

interface Article { id: string; title: string; source: string | null; tags: string[] }

test('approved advice waits for a second person before it answers questions', async ({ browser, request }) => {
  // Daniel queues advice he wants checked before it is used again.
  const officer = await apiAs(request, SEEDED.officerNakuru);
  const queued = await officer.post('/api/v1/ai/reviews', { farmerId: JOURNEY.farmer.id, recommendation: ADVICE, confidence: 70 });
  expect(queued.status(), await queued.text()).toBe(201);

  // Wanjiru approves it on the Reports page and adds it to the knowledge base.
  const { context, page } = await signedIn(browser, SEEDED.managerNakuru.email);
  await page.goto('/reports');
  const item = page.getByRole('article', { name: 'Recommendation awaiting review' }).filter({ hasText: `run ${RUN}` });
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.getByLabel('Reason for your decision').fill('Matches the national fall armyworm scouting guide.');
  await item.getByRole('button', { name: 'Approve' }).click();

  await expect(item.getByText('Approved. Add this advice to the knowledge base?')).toBeVisible();
  await expect(item.getByLabel('Advice')).toHaveValue(ADVICE);
  await item.getByLabel('Title').fill(TITLE);
  await item.getByLabel('Crops').fill('maize');
  await item.getByLabel('Sources (optional)').fill('National fall armyworm scouting guide');
  await item.getByRole('button', { name: 'Add to knowledge base' }).click();
  await expect(page.getByText('Added. It will answer questions once a manager approves the document.')).toBeVisible();
  await context.close();

  // The document waits in quarantine, credited to the agronomist who approved the advice.
  const manager = await apiAs(request, SEEDED.managerNakuru.email);
  const waiting = ((await (await manager.get('/api/v1/knowledge/quarantine')).json()) as { data: Article[] }).data;
  const document = waiting.find(doc => doc.title === TITLE);
  expect(document, 'the new document is waiting for approval').toBeTruthy();
  expect(document!.source).toMatch(/^Advice approved by Wanjiru Kamau, /);
  const article = ((await (await manager.get(`/api/v1/knowledge/${document!.id}`)).json()) as { data: Article }).data;
  expect(article.tags).toEqual(expect.arrayContaining(['reviewed_answer', 'pending_review']));
  expect(article.source).not.toContain(JOURNEY.farmer.name);

  // The person who approved the advice cannot also approve the document.
  const selfApproval = await manager.post(`/api/v1/knowledge/quarantine/${document!.id}/clear`, { verdict: 'approve' });
  expect(selfApproval.status()).toBe(403);
  expect((await selfApproval.json()).error).toContain('another manager or administrator must approve');

  const admin = e2eAdmin();
  if (onSharedSite || !admin) {
    // Never leave test advice answering real farmers: reject it (a rejection needs no second person).
    const rejected = await manager.post(`/api/v1/knowledge/quarantine/${document!.id}/clear`, { verdict: 'reject' });
    expect(rejected.status()).toBe(200);
    expect((await manager.get(`/api/v1/knowledge/${document!.id}`)).status()).toBe(404);
    return;
  }
  const administrator = await apiAs(request, admin.email, admin.password);
  const approved = await administrator.post(`/api/v1/knowledge/quarantine/${document!.id}/clear`, { verdict: 'approve' });
  expect(approved.status(), await approved.text()).toBe(200);
  const live = ((await (await manager.get(`/api/v1/knowledge/${document!.id}`)).json()) as { data: Article }).data;
  expect(live.tags).toContain('reviewed_answer');
  expect(live.tags).not.toContain('pending_review');
});
