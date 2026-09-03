/**
 * Contract tests for the remediation round: each block pins a behaviour that was
 * previously broken in a way tests did not catch (wrong route shape, silent
 * fallback, cross-user cache replay, etc.).
 */
import { Request, Response, NextFunction } from 'express';

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ─── Idempotency middleware: key must be scoped to the principal ───────────────
import { idempotencyMiddleware, clearIdempotencyStore } from '@/middleware/idempotencyMiddleware';

function makeRes(): Response & { body?: unknown } {
  const res: Partial<Response> & { body?: unknown } = { statusCode: 201 };
  res.status = jest.fn().mockImplementation((code: number) => { res.statusCode = code; return res; }) as never;
  res.setHeader = jest.fn() as never;
  res.json = jest.fn().mockImplementation((body: unknown) => { res.body = body; return res; }) as never;
  return res as Response & { body?: unknown };
}

describe('idempotencyMiddleware scoping', () => {
  beforeEach(() => clearIdempotencyStore());

  const baseReq = (userId: string, path = '/api/visits'): Request => ({
    method: 'POST',
    path,
    baseUrl: '',
    ip: '10.0.0.1',
    headers: { 'idempotency-key': 'shared-key-123' },
    user: { userId, email: `${userId}@x`, role: 'extension_officer' },
    body: {},
  } as unknown as Request);

  it('replays for the same user + path + key', async () => {
    const next: NextFunction = jest.fn();
    const r1 = makeRes();
    await idempotencyMiddleware(baseReq('u1'), r1, next);
    r1.json({ ok: 1 });

    const r2 = makeRes();
    const next2: NextFunction = jest.fn();
    await idempotencyMiddleware(baseReq('u1'), r2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(r2.setHeader).toHaveBeenCalledWith('X-Cache-Lookup', 'HIT-IDEMPOTENT');
    expect(r2.body).toEqual({ ok: 1 });
  });

  it('does NOT replay another user\'s cached response for the same key', async () => {
    const r1 = makeRes();
    await idempotencyMiddleware(baseReq('u1'), r1, jest.fn());
    r1.json({ secret: 'u1 data' });

    const r2 = makeRes();
    const next2: NextFunction = jest.fn();
    await idempotencyMiddleware(baseReq('u2'), r2, next2);
    expect(next2).toHaveBeenCalled();
    expect(r2.body).toBeUndefined();
  });

  it('does NOT replay across different paths for the same user + key', async () => {
    const r1 = makeRes();
    await idempotencyMiddleware(baseReq('u1', '/api/visits'), r1, jest.fn());
    r1.json({ ok: 1 });

    const next2: NextFunction = jest.fn();
    await idempotencyMiddleware(baseReq('u1', '/api/sms/send'), makeRes(), next2);
    expect(next2).toHaveBeenCalled();
  });

  it('returns 409 for a concurrent duplicate that is still in flight', async () => {
    const r1 = makeRes();
    await idempotencyMiddleware(baseReq('u1'), r1, jest.fn()); // never calls res.json → in flight

    const r2 = makeRes();
    const next2: NextFunction = jest.fn();
    await idempotencyMiddleware(baseReq('u1'), r2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(r2.status).toHaveBeenCalledWith(409);
  });
});

// ─── Tool-calling normalisation shared by all OpenAI-compatible providers ─────
import { z } from 'zod';
import {
  normalizeToolDefinitions,
  normalizeMessages,
  normalizeToolCalls,
  parseToolArguments,
} from '@/services/aiProvider/toolCalling';

describe('toolCalling normalisation', () => {
  it('accepts OpenAI function definitions verbatim', () => {
    const out = normalizeToolDefinitions([
      { type: 'function', function: { name: 'get_weather_forecast', description: 'w', parameters: { type: 'object', properties: { location: { type: 'string' } } } } },
    ]);
    expect(out).toHaveLength(1);
    expect(out![0].function.name).toBe('get_weather_forecast');
    expect(out![0].function.parameters).toEqual({ type: 'object', properties: { location: { type: 'string' } } });
  });

  it('converts internal zod Tool objects to function definitions', () => {
    const out = normalizeToolDefinitions([
      { name: 'diagnose_plant_disease', description: 'd', schema: z.object({ symptoms: z.array(z.string()), cropType: z.string().optional() }) },
    ]);
    expect(out).toHaveLength(1);
    const params = out![0].function.parameters as { type: string; properties: Record<string, unknown>; required?: string[] };
    expect(params.type).toBe('object');
    expect(Object.keys(params.properties)).toEqual(expect.arrayContaining(['symptoms', 'cropType']));
    expect(params.required).toEqual(['symptoms']);
  });

  it('returns undefined for empty/garbage tool lists instead of throwing', () => {
    expect(normalizeToolDefinitions(undefined)).toBeUndefined();
    expect(normalizeToolDefinitions([])).toBeUndefined();
    expect(normalizeToolDefinitions([null, {}, { foo: 'bar' }] as unknown[])).toBeUndefined();
  });

  it('wraps a string prompt into system+user messages and passes message arrays through', () => {
    const wrapped = normalizeMessages('hello');
    expect(wrapped).toHaveLength(2);
    expect(wrapped[1]).toEqual({ role: 'user', content: 'hello' });

    const msgs = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }];
    expect(normalizeMessages(msgs)).toBe(msgs);
  });

  it('normalises provider tool_calls and parses stringified JSON arguments', () => {
    const calls = normalizeToolCalls([
      { id: 'call_1', type: 'function', function: { name: 'get_market_prices', arguments: '{"crop":"maize"}' } },
      { function: { name: 'x', arguments: { a: 1 } } },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls![0].function.arguments).toBe('{"crop":"maize"}');
    expect(calls![1].function.arguments).toBe('{"a":1}');
    expect(parseToolArguments(calls![0].function.arguments)).toEqual({ crop: 'maize' });
    expect(parseToolArguments('not json')).toEqual({});
    expect(parseToolArguments('prefix {"k":2} suffix')).toEqual({ k: 2 });
    expect(parseToolArguments({ k: 3 })).toEqual({ k: 3 });
  });
});

// ─── Embedding dimension guard ────────────────────────────────────────────────
import { assertEmbeddingDimensions, EMBEDDING_DIMENSIONS, EmbeddingDimensionError } from '@/services/embeddingCache';

describe('embedding dimension guard', () => {
  it('accepts vectors matching the configured column width', () => {
    expect(() => assertEmbeddingDimensions(new Array(EMBEDDING_DIMENSIONS).fill(0.1))).not.toThrow();
  });
  it('rejects mismatched vectors with an actionable error', () => {
    expect(() => assertEmbeddingDimensions(new Array(3072).fill(0))).toThrow(EmbeddingDimensionError);
    expect(() => assertEmbeddingDimensions([])).toThrow(/dimensions/);
  });
});

// ─── MFA backup codes are stored hashed and still verify ──────────────────────
jest.mock('@/services/databaseService', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));
import { hashBackupCodes, verifyAndConsumeBackupCode, generateBackupCodes } from '@/services/mfaService';

describe('MFA backup codes', () => {
  it('hashes codes at rest and verifies plaintext input against the hash', async () => {
    const codes = generateBackupCodes(3);
    const stored = hashBackupCodes(codes);
    expect(stored.every(c => c.startsWith('sha256:'))).toBe(true);
    expect(stored).not.toContain(codes[0]);

    const ok = await verifyAndConsumeBackupCode('user-1', codes[1].toLowerCase(), stored);
    expect(ok.valid).toBe(true);
    expect(ok.remainingCodes).toHaveLength(2);

    const bad = await verifyAndConsumeBackupCode('user-1', 'ZZZZ-ZZZZ', stored);
    expect(bad.valid).toBe(false);
  });

  it('still accepts legacy plaintext rows', async () => {
    const ok = await verifyAndConsumeBackupCode('user-1', 'ab12-cd34', ['AB12-CD34']);
    expect(ok.valid).toBe(true);
  });
});
