/**
 * Contract tests for the third remediation round.
 */
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ─── TOTP replay guard ────────────────────────────────────────────────────────
import { generateMfaSecret, generateTotpCode, matchTotpStep } from '@/services/mfaService';

describe('matchTotpStep', () => {
  it('returns the matched 30s step and rejects garbage', () => {
    const { secret } = generateMfaSecret('u@x', 'GPExts');
    const now = Date.now();
    const code = generateTotpCode(secret, 30, now);
    const step = matchTotpStep(code, secret, 1, 30, now);
    expect(step).toBe(Math.floor(now / 30000));
    expect(matchTotpStep('000000', secret, 1, 30, now) === Math.floor(now / 30000) && code !== '000000').toBe(false);
    expect(matchTotpStep('abc', secret)).toBeNull();
  });

  it('a code from the previous step matches the previous step (so replay compares strictly by step)', () => {
    const { secret } = generateMfaSecret('u@x', 'GPExts');
    const now = Date.now();
    const prev = generateTotpCode(secret, 30, now - 30000);
    expect(matchTotpStep(prev, secret, 1, 30, now)).toBe(Math.floor((now - 30000) / 30000));
  });
});

// ─── Password policy ──────────────────────────────────────────────────────────
import { passwordProblems, passwordSchema } from '@/utils/passwordPolicy';

describe('password policy', () => {
  it('rejects short, letter-only, digit-only, common and email-derived passwords', () => {
    expect(passwordProblems('short1')).toEqual(expect.arrayContaining([expect.stringMatching(/at least 10/)]));
    expect(passwordProblems('abcdefghijk')).toEqual(expect.arrayContaining(['at least one number']));
    expect(passwordProblems('12345678901')).toEqual(expect.arrayContaining(['at least one letter']));
    expect(passwordProblems('password123')).toEqual(expect.arrayContaining(['not a commonly used password']));
    expect(passwordProblems('johnsmith2024', 'johnsmith@farm.co')).toEqual(expect.arrayContaining(['must not contain your email name']));
    expect(passwordProblems('Kilimo-Bora-2026')).toEqual([]);
    expect(passwordSchema.safeParse('Kilimo-Bora-2026').success).toBe(true);
    expect(passwordSchema.safeParse('weak').success).toBe(false);
  });
});

// ─── Stealth scraper normalisation (Agent Zero → backend) ────────────────────
jest.mock('axios');
import axios from 'axios';
import { StealthScraperService } from '@/services/stealthScraperService';

describe('StealthScraperService.scrapeKnowledge', () => {
  const post = axios.post as jest.Mock;
  beforeEach(() => { post.mockReset(); process.env.AGENT_ZERO_TOKEN = 'tok'; });
  afterEach(() => { delete process.env.AGENT_ZERO_TOKEN; });

  it('maps ContentCandidate rows (title/description/source_uri/tags) and labels them unverified', async () => {
    post.mockResolvedValue({ data: { success: true, results: [
      { id: 'c1', platform: 'cabi_plantwise', source_uri: 'https://x/1', title: 'Maize lethal necrosis', description: 'Symptoms…', tags: ['maize', 'virus'] },
      { id: 'c2', title: '', description: '' }, // dropped: nothing usable
    ] } });
    const docs = await StealthScraperService.scrapeKnowledge('maize disease', 'cabi_plantwise', 'Kenya');
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ title: 'Maize lethal necrosis', summary: 'Symptoms…', url: 'https://x/1', keywords: ['maize', 'virus'], dataStatus: 'unverified_scrape' });
    expect(post.mock.calls[0][0]).toMatch(/\/api\/execute$/);
    expect(post.mock.calls[0][1]).toEqual({ task_type: 'stealth_scrape', parameters: { niche: 'maize disease', platform: 'cabi_plantwise', region: 'Kenya' } });
    expect(post.mock.calls[0][2].headers.Authorization).toBe('Bearer tok');
  });

  it('unwraps Agent Zero /api/execute { result: {...} } envelopes and throws on failure', async () => {
    post.mockResolvedValue({ data: { success: true, result: { success: false, error: 'scraper down' } } });
    await expect(StealthScraperService.scrapeKnowledge('x', 'fao_crop_guides', 'Global')).rejects.toThrow(/scraper down/);
  });

  it('throws (does not silently return []) when neither token nor JWT secret exists', async () => {
    delete process.env.AGENT_ZERO_TOKEN;
    const { config } = await import('@/config');
    const saved = config.jwt.secret;
    (config.jwt as { secret: string }).secret = '';
    await expect(StealthScraperService.scrapeKnowledge('x', 'fao_crop_guides', 'Global')).rejects.toThrow(/AGENT_ZERO_TOKEN nor JWT_SECRET/);
    (config.jwt as { secret: string }).secret = saved;
  });
});

// ─── Notification job dedup ──────────────────────────────────────────────────
import { notificationJobId } from '@/queues/notificationQueue';

describe('notificationJobId', () => {
  const base = { userId: 'u1', type: 'info' as const, title: 'Rain alert', message: 'm', channel: 'in_app' as const };
  it('is deterministic for the same schedule and differs across schedules/hops', () => {
    const a = notificationJobId({ ...base, metadata: { scheduledAt: '2026-09-10T06:00:00Z' } });
    const b = notificationJobId({ ...base, metadata: { scheduledAt: '2026-09-10T06:00:00Z' } });
    const c = notificationJobId({ ...base, metadata: { scheduledAt: '2026-09-11T06:00:00Z' } });
    const d = notificationJobId({ ...base, metadata: { scheduledAt: '2026-09-10T06:00:00Z', dedupKey: 'x|hop1' } });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toMatch(/^notif:[0-9a-f]{40}$/);
  });
});

// ─── Audit log writer redacts secrets ────────────────────────────────────────
const dbQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/services/databaseService', () => ({ query: (...a: unknown[]) => dbQuery(...a), getPool: () => null }));
import { writeAuditLog } from '@/middleware/auditMiddleware';

describe('writeAuditLog', () => {
  it('persists a row with redacted body', async () => {
    dbQuery.mockClear();
    await writeAuditLog({
      actorId: 'u1', actorRole: 'admin', action: 'post.users', method: 'POST', path: '/api/v1/users',
      statusCode: 201, requestBody: { email: 'a@b', password: 'hunter22', nested: { token: 'abc', ok: 1 } },
    });
    expect(dbQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = dbQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO audit_logs/);
    const body = params[10];
    expect(body).toContain('a@b');
    expect(body).not.toContain('hunter22');
    expect(body).not.toContain('"abc"');
  });
});

// ─── Chat completions: tool loop end-to-end with a mocked provider ───────────
const routeRequest = jest.fn();
jest.mock('@/services/aiProvider/aiProvider', () => ({ AIRouter: { routeRequest: (...a: unknown[]) => routeRequest(...a) } }));
jest.mock('@/services/ragV2Service', () => ({ RAGV2Service: { enhancedSearch: jest.fn().mockResolvedValue({ results: [], citations: [] }) } }));
jest.mock('@/services/vectorService', () => ({ VectorService: { hybridSearch: jest.fn().mockResolvedValue([]) } }));
const callTool = jest.fn();
jest.mock('@/services/mcpAdapter', () => ({
  mcpAdapter: {
    callTool: (...a: unknown[]) => callTool(...a),
    convertToMCPTools: () => [{ name: 'get_weather_forecast', description: 'w', inputSchema: { type: 'object', properties: { location: { type: 'string' } } } }],
  },
}));
jest.mock('@/middleware/authorize', () => ({
  authorize: () => (req: { user?: unknown }, _res: unknown, next: () => void) => { req.user = { userId: 'u1', role: 'extension_officer', email: 'o@x' }; next(); },
}));
jest.mock('@/middleware/usageMiddleware', () => ({ checkUsageLimit: () => (_r: unknown, _s: unknown, n: () => void) => n() }));

import express from 'express';
import request from 'supertest';
import completionsRouter from '@/routes/chatbot/completions';

describe('POST /chatbot/completions tool loop', () => {
  const app = express();
  app.use(express.json());
  app.use('/chatbot', completionsRouter);

  beforeEach(() => { routeRequest.mockReset(); callTool.mockReset(); dbQuery.mockResolvedValue({ rows: [] }); });

  it('executes a requested tool, feeds the result back as a tool message, and reports usedTools', async () => {
    routeRequest
      .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather_forecast', arguments: '{"location":"Nakuru"}' } }] })
      .mockResolvedValueOnce({ text: 'Expect rain in Nakuru tomorrow; delay top-dressing.' });
    callTool.mockResolvedValue({ content: [{ type: 'text', text: '{"forecast":"rain"}' }] });

    const res = await request(app).post('/chatbot/completions').send({ message: 'Should I fertilise in Nakuru tomorrow?' });
    expect(res.status).toBe(200);
    expect(res.body.data.usedTools).toEqual(['get_weather_forecast']);
    expect(res.body.data.messages[1].content).toMatch(/delay top-dressing/);
    expect(callTool).toHaveBeenCalledWith('get_weather_forecast', { location: 'Nakuru' });

    // Second provider call must carry the assistant tool_calls echo and a tool-role message.
    const secondPrompt = routeRequest.mock.calls[1][1].prompt as Array<Record<string, unknown>>;
    expect(secondPrompt.some(m => m.role === 'assistant' && Array.isArray(m.tool_calls))).toBe(true);
    const toolMsg = secondPrompt.find(m => m.role === 'tool') as Record<string, unknown>;
    expect(toolMsg).toMatchObject({ tool_call_id: 'call_1', name: 'get_weather_forecast' });
    expect(String(toolMsg.content)).toContain('"forecast":"rain"');
  });

  it('rejects legacy/invalid bodies with 400 via the shared contract', async () => {
    const res = await request(app).post('/chatbot/completions').send({ message: '' });
    expect(res.status).toBe(400);
  });

  it('accepts the legacy snake_case conversation_id', async () => {
    routeRequest.mockResolvedValueOnce({ text: 'ok' });
    const res = await request(app).post('/chatbot/completions').send({ message: 'hi', conversation_id: '11111111-1111-4111-8111-111111111111' });
    expect(res.status).toBe(200);
  });
});
