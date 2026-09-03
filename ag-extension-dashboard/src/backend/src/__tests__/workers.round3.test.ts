/**
 * Worker / orchestrator behaviour pinned after the remediation rounds.
 */
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
const dbQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/services/databaseService', () => ({ query: (...a: unknown[]) => dbQuery(...a), getPool: () => null }));

// ─── agentOrchestrator.stopAgentTasks ────────────────────────────────────────
jest.mock('@/services/aiProvider/aiProvider', () => ({ AIRouter: { routeRequest: jest.fn() } }));
jest.mock('@/services/agentTelemetry', () => ({ agentTelemetry: { record: jest.fn().mockResolvedValue(undefined) } }));

import { agentOrchestrator } from '@/services/agentOrchestrator';

describe('agentOrchestrator.stopAgentTasks', () => {
  beforeEach(() => dbQuery.mockClear());

  it('fails queued tasks for the agent only, persists them, and leaves other agents untouched', async () => {
    agentOrchestrator.registerAgent({ agentId: 'agent-a', name: 'A', capabilities: ['*'], maxConcurrentTasks: 1 });
    agentOrchestrator.registerAgent({ agentId: 'agent-b', name: 'B', capabilities: ['*'], maxConcurrentTasks: 1 });
    const t1 = await agentOrchestrator.dispatchTask({ agentId: 'agent-a', type: 'x', payload: {}, priority: 'low', maxRetries: 0 });
    const t2 = await agentOrchestrator.dispatchTask({ agentId: 'agent-a', type: 'x', payload: {}, priority: 'low', maxRetries: 0 });
    const t3 = await agentOrchestrator.dispatchTask({ agentId: 'agent-b', type: 'x', payload: {}, priority: 'low', maxRetries: 0 });

    const result = await agentOrchestrator.stopAgentTasks('agent-a');
    expect(result.queued).toBeGreaterThanOrEqual(2);
    expect(result.stopped).toBe(0);

    const statuses = Object.fromEntries([t1, t2, t3].map(t => [t.id, agentOrchestrator.getTaskStatus(t.id)?.status]));
    expect(statuses[t1.id]).toBe('failed');
    expect(statuses[t2.id]).toBe('failed');
    expect(statuses[t3.id]).toBe('pending');

    const persistedFailed = dbQuery.mock.calls.filter(c => /INSERT INTO agent_tasks/.test(String(c[0])) && Array.isArray(c[1]) && (c[1] as unknown[])[5] === 'failed');
    expect(persistedFailed.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── ingestionWorker: honest labelling + abort on transport failure ──────────
const scrapeKnowledge = jest.fn();
jest.mock('@/services/stealthScraperService', () => ({ StealthScraperService: { scrapeKnowledge: (...a: unknown[]) => scrapeKnowledge(...a) } }));
const upsertDocument = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: (...a: unknown[]) => upsertDocument(...a) } }));
jest.mock('@/config', () => ({ config: { ingestion: { enabled: true }, jwt: { secret: 'x' }, nodeEnv: 'test' } }));

describe('runBatchIngestion', () => {
  beforeEach(() => { scrapeKnowledge.mockReset(); upsertDocument.mockClear(); jest.useFakeTimers({ advanceTimers: true }); });
  afterEach(() => jest.useRealTimers());

  it('labels every upserted document as an unverified web extract', async () => {
    scrapeKnowledge.mockResolvedValue([{ id: 'd1', title: 'Fall armyworm scouting', summary: 'Scout weekly', url: 'https://x/1', keywords: ['faw'], platform: 'cabi_plantwise', publishedAt: null, dataStatus: 'unverified_scrape' }]);
    const { runBatchIngestion } = await import('@/workers/ingestionWorker');
    const p = runBatchIngestion();
    await jest.advanceTimersByTimeAsync(60_000 * 5);
    await p;
    expect(upsertDocument).toHaveBeenCalled();
    const [, content, metadata] = upsertDocument.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(metadata.title).toMatch(/^Web extract \(unverified\):/);
    expect(metadata.dataStatus).toBe('unverified_scrape');
    expect((metadata.tags as string[])).toContain('unverified_scrape');
    expect(content).toMatch(/Fall armyworm scouting/);
    expect(JSON.stringify(metadata)).not.toMatch(/Validated/);
  });

  it('aborts the crawl after two consecutive transport failures instead of hammering every task', async () => {
    scrapeKnowledge.mockRejectedValue(new Error('connect ECONNREFUSED ag-agent-zero:8000'));
    const { runBatchIngestion } = await import('@/workers/ingestionWorker');
    const p = runBatchIngestion();
    await jest.advanceTimersByTimeAsync(60_000 * 5);
    await p;
    expect(scrapeKnowledge.mock.calls.length).toBe(2);
    expect(upsertDocument).not.toHaveBeenCalled();
  });
});
