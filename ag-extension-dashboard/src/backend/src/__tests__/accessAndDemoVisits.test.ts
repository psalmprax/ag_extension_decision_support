const query = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => query(...args) }));
const isFreeUser = jest.fn();
jest.mock('@/services/usageService', () => ({ usageService: { isFreeUser: (...args: unknown[]) => isFreeUser(...args) } }));
const hasServiceAccess = jest.fn();
jest.mock('@/services/serviceAccessService', () => ({ hasServiceAccess: (...args: unknown[]) => hasServiceAccess(...args) }));

import type { NextFunction, Request, Response } from 'express';
import { refusedWhileBillingOff } from '@/routes/billing';
import { demoVisitDays } from '@/routes/demoVisits';
import { demoSessionGuard } from '@/middleware/demoSessionGuard';
import { PAID_SERVICES, isGrantableTo } from '@/services/paidServices';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';
import {
  DEMO_VISIT_RETENTION_DAYS,
  __resetDemoVisitsForTests,
  placeFromDatabase,
  placeFromHeaders,
  pruneDemoVisits,
  recordDemoVisit,
  shortenIp,
} from '@/services/demoVisits';

function run(middleware: (req: Request, res: Response, next: NextFunction) => unknown, req: Partial<Request>) {
  const res = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  const next = jest.fn();
  return Promise.resolve(middleware(req as Request, res as unknown as Response, next)).then(() => ({ res, next }));
}

describe('billing switched off', () => {
  it('refuses only what would start a payment', () => {
    for (const path of ['/subscribe', '/switch', '/paypal/subscribe', '/paypal/subscription', '/mpesa/stk-push', '/transaction/submit', '/payment-methods']) {
      expect(refusedWhileBillingOff('POST', path)).toBe(true);
    }
    // Cancelling, managing an existing subscription, webhooks, vouchers and reading stay open.
    for (const path of ['/cancel', '/portal', '/paypal/webhook', '/webhook', '/voucher/redeem', '/mpesa/callback/s3cret']) {
      expect(refusedWhileBillingOff('POST', path)).toBe(false);
    }
    expect(refusedWhileBillingOff('GET', '/subscription')).toBe(false);
    // Express also routes these to the same handlers.
    expect(refusedWhileBillingOff('POST', '/Subscribe')).toBe(true);
    expect(refusedWhileBillingOff('post', '/subscribe/')).toBe(true);
    expect(refusedWhileBillingOff('POST', '/PayPal/Subscription//')).toBe(true);
    expect(refusedWhileBillingOff('POST', '/Cancel/')).toBe(false);
    expect(refusedWhileBillingOff('POST', '/subscribe', true)).toBe(false);
  });
});

describe('locked features', () => {
  beforeEach(() => {
    isFreeUser.mockReset();
    hasServiceAccess.mockReset();
  });

  it('adds Knowledge AI answers, Crops & fields and Reports as services an administrator can grant', () => {
    expect(Object.keys(PAID_SERVICES)).toEqual(expect.arrayContaining(['knowledge_ai', 'fields', 'reports']));
    expect(isGrantableTo('fields', 'farmer')).toBe(true);
    expect(isGrantableTo('reports', 'farmer')).toBe(false);
    expect(isGrantableTo('reports', 'extension_officer')).toBe(true);
  });

  it('refuses a Free account without the grant, and lets a granted one through', async () => {
    isFreeUser.mockResolvedValue(true);
    hasServiceAccess.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const user = { userId: 'u1', role: 'extension_officer' };
    const refused = await run(requirePaidPlan('fields'), { user } as Partial<Request>);
    expect(refused.res.statusCode).toBe(403);
    expect(refused.next).not.toHaveBeenCalled();
    const granted = await run(requirePaidPlan('fields'), { user } as Partial<Request>);
    expect(granted.next).toHaveBeenCalled();
  });

  it('refuses the demo AI answers, fields, reports and the demo visit list, but keeps knowledge search open', async () => {
    const demo = { isDemo: true };
    for (const [method, path] of [['POST', '/api/v1/knowledge/ask'], ['GET', '/api/v1/fields'], ['GET', '/api/v1/reporting'], ['GET', '/api/v1/demo-visits']]) {
      const { res, next } = await run(demoSessionGuard, { user: demo, method, path } as unknown as Partial<Request>);
      expect([path, res.statusCode]).toEqual([path, 403]);
      expect(next).not.toHaveBeenCalled();
    }
    const search = await run(demoSessionGuard, { user: demo, method: 'GET', path: '/api/v1/knowledge/search' } as unknown as Partial<Request>);
    expect(search.next).toHaveBeenCalled();
  });
});

describe('demo visits', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    __resetDemoVisitsForTests();
    process.env.GEOIP_DB_PATH = '/nonexistent/dbip-city-lite.mmdb';
  });

  it('keeps only the first part of an IP address', () => {
    expect(shortenIp('203.0.113.42')).toBe('203.0.113.x');
    expect(shortenIp('::ffff:198.51.100.7')).toBe('198.51.100.x');
    expect(shortenIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:85a3::/48');
    expect(shortenIp('2001:db8::1')).toBe('2001:db8:0::/48');
    // "::" can stand for groups before the third one: they are filled in first.
    expect(shortenIp('2001::1:2:3:4:5:6')).toBe('2001:0:1::/48');
    expect(shortenIp('2001:0DB8:0000:85a3::1')).toBe('2001:db8:0::/48');
    expect(shortenIp('::1')).toBe('0:0:0::/48');
    expect(shortenIp('64:ff9b::192.0.2.33')).toBe('64:ff9b:0::/48');
    expect(shortenIp('unknown')).toBeNull();
  });

  it("takes the place from Cloudflare's headers, and ignores an unknown country", () => {
    expect(placeFromHeaders({ 'cf-ipcountry': 'KE', 'cf-region': 'Nairobi County', 'cf-ipcity': 'Nairobi' })).toEqual({
      countryCode: 'KE', region: 'Nairobi County', city: 'Nairobi', source: 'cdn',
    });
    expect(placeFromHeaders({ 'cf-ipcountry': 'NG', 'cf-ipcity': 'Ilor%C3%AD' })?.city).toBe('Ilorí');
    expect(placeFromHeaders({ 'cf-ipcountry': 'XX' })).toBeNull();
    expect(placeFromHeaders({})).toBeNull();
  });

  it('leaves the place empty, rather than guessing, without headers or a city database', async () => {
    expect(await placeFromDatabase('203.0.113.42')).toBeNull();
    await recordDemoVisit({ ip: '203.0.113.42', headers: {}, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/131.0' });
    const [, values] = query.mock.calls[0] as [string, unknown[]];
    expect(values.slice(0, 4)).toEqual([null, null, null, '203.0.113.x']);
    expect(values[5]).toBeNull();
  });

  it('never stores the full IP address', async () => {
    await recordDemoVisit({ ip: '203.0.113.42', headers: { 'cf-ipcountry': 'KE', 'cf-ipcity': 'Nairobi' }, userAgent: null });
    expect(JSON.stringify(query.mock.calls)).not.toContain('203.0.113.42');
    const [, values] = query.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(expect.arrayContaining(['KE', 'Nairobi', '203.0.113.x', 'cdn']));
  });

  it('never stops someone opening the demo when the visit cannot be saved', async () => {
    query.mockRejectedValueOnce(new Error('relation "demo_visits" does not exist'));
    await expect(recordDemoVisit({ ip: '203.0.113.42', headers: {}, userAgent: null })).resolves.toBeUndefined();
  });

  it('asks the database for whole days only, from 1 to 90, 30 by default', () => {
    expect([2.5, '7', 0.4, -3, 500, 'many', undefined, ''].map(demoVisitDays)).toEqual([2, 7, 1, 1, 90, 30, 30, 30]);
  });

  it('deletes visits older than 90 days', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 4 });
    expect(await pruneDemoVisits()).toBe(4);
    expect(query.mock.calls[0][1]).toEqual([DEMO_VISIT_RETENTION_DAYS]);
    expect(DEMO_VISIT_RETENTION_DAYS).toBe(90);
  });
});
