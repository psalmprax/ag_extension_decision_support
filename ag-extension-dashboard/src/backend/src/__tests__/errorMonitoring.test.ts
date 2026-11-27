jest.mock('@/services/cacheService', () => ({ getCache: () => null }));
jest.mock('@sentry/node', () => ({ captureMessage: jest.fn(), captureException: jest.fn() }));

import express, { type Request, type Response } from 'express';
import request from 'supertest';
import * as Sentry from '@sentry/node';
import {
  failureSummary,
  recordFailure,
  routePattern,
  withoutPersonalData,
  __resetFailureMonitorForTests,
} from '@/services/failureMonitor';
import { failureRecorder } from '@/middleware/failureRecorder';
import clientErrorRoutes, { pageOf } from '@/routes/clientErrors';
import monitoringRoutes, { tokenMatches } from '@/routes/monitoring';
import { withoutRequestData } from '@/utils/sentryScrub';

const TOKEN = 'a-monitoring-token-of-32-characters';

function appWith(): express.Express {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(failureRecorder);
  app.use('/api/v1/errors', clientErrorRoutes);
  app.use('/api/v1/monitoring', monitoringRoutes);
  app.post('/api/reporting/generate', (_req: Request, res: Response) => {
    res.status(400).json({ success: false, error: 'Unsupported report type: synthesis' });
  });
  app.get('/api/v1/upload/file/:key', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'File not found' });
  });
  app.get('/api/me', (_req: Request, res: Response) => {
    res.status(401).json({ success: false, error: 'Not signed in' });
  });
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(503).json({ success: false, error: 'starting' });
  });
  return app;
}

const settle = () => new Promise(resolve => setImmediate(resolve));

describe('production error monitoring', () => {
  beforeEach(() => {
    __resetFailureMonitorForTests();
    (Sentry.captureMessage as jest.Mock).mockClear();
    delete process.env.MONITORING_TOKEN;
  });

  it('groups routes by pattern, whatever ids they carry', () => {
    expect(routePattern('/api/v1/upload/file/1249d72d-9f35-443a-b4f3-50021e7cf476.png')).toBe('/api/upload/file/:id');
    expect(routePattern('/api/farmers/42/progress?tab=all')).toBe('/api/farmers/:id/progress');
  });

  it("counts tonight's kinds of failure with their error text, and ignores 401 and health probes", async () => {
    const app = appWith();
    await request(app).post('/api/reporting/generate').send({ type: 'synthesis' });
    await request(app).post('/api/reporting/generate').send({ type: 'synthesis' });
    await request(app).get('/api/v1/upload/file/1249d72d-9f35-443a-b4f3-50021e7cf476.png');
    await request(app).get('/api/v1/upload/file/16ed1d72-c650-491d-bd41-fe979ab17cb3.png');
    await request(app).get('/api/me');
    await request(app).get('/api/v1/health');
    await settle();

    const failures = await failureSummary(1);
    expect(failures).toEqual([
      { kind: 'server', method: 'POST', route: '/api/reporting/generate', status: 400, count: 2, sample: 'Unsupported report type: synthesis' },
      { kind: 'server', method: 'GET', route: '/api/upload/file/:id', status: 404, count: 2, sample: 'File not found' },
    ]);
  });

  it('removes emails and phone numbers from kept error text', async () => {
    expect(withoutPersonalData('No farmer amina@example.org at +254 712 345 678')).toBe('No farmer [email] at [number]');
    await recordFailure('server', 'POST', '/api/farmers', 409, 'Phone 0712345678 is taken');
    expect((await failureSummary(1))[0].sample).toBe('Phone [number] is taken');
  });

  it('takes browser crash reports, counts them per page, and sends boundary crashes to Sentry', async () => {
    const res = await request(appWith()).post('/api/v1/errors').send({
      error: { name: 'TypeError', message: "Cannot read properties of undefined (reading 'summary')", stack: 'at x' },
      componentStack: 'at FarmerDetailPanel',
      componentName: 'MainContent',
      url: 'https://www.gpexts.com/farmers/8de519c5-432d-42b6-960d-d41c5cb7cb6f?tab=visits',
    });
    expect(res.status).toBe(204);
    await settle();
    expect(await failureSummary(1)).toEqual([
      { kind: 'browser', method: 'BOUNDARY', route: '/farmers/:id', status: 0, count: 1, sample: "TypeError: Cannot read properties of undefined (reading 'summary')" },
    ]);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('answers 204 to a malformed report and records it as unknown', async () => {
    const res = await request(appWith()).post('/api/v1/errors').send('not json').set('Content-Type', 'text/plain');
    expect(res.status).toBe(204);
    expect(pageOf(undefined)).toBe('(unknown page)');
  });

  it('serves the failure summary only with the right token, and hides it when none is set', async () => {
    const app = appWith();
    expect((await request(app).get('/api/v1/monitoring/failures')).status).toBe(404);
    process.env.MONITORING_TOKEN = TOKEN;
    expect((await request(app).get('/api/v1/monitoring/failures').set('x-monitoring-token', 'wrong')).status).toBe(403);
    await recordFailure('server', 'GET', '/api/notifications', 403, 'Demo accounts are read-only');
    const ok = await request(app).get('/api/v1/monitoring/failures?hours=2').set('x-monitoring-token', TOKEN);
    expect(ok.status).toBe(200);
    expect(ok.body.hours).toBe(2);
    expect(ok.body.failures[0]).toMatchObject({ route: '/api/notifications', status: 403, count: 1 });
    expect(tokenMatches(TOKEN, 'short')).toBe(false);
  });

  it('gives the browser its Sentry DSN, or null when Sentry is off', async () => {
    const res = await request(appWith()).get('/api/v1/monitoring/browser-config');
    expect(res.status).toBe(200);
    expect(res.body.sentryDsn).toBeNull();
  });

  it('sends Sentry no cookies, headers, bodies, query strings or user', () => {
    const event = withoutRequestData({
      type: undefined,
      message: 'Lookup failed for amina@example.org',
      user: { id: 'u1', email: 'amina@example.org' },
      request: { method: 'POST', url: 'https://www.gpexts.com/api/farmers?phone=0712345678', headers: { cookie: 'x' }, data: { phone: '0712345678' } },
    });
    expect(event.request).toEqual({ method: 'POST', url: 'https://www.gpexts.com/api/farmers' });
    expect(event.user).toBeUndefined();
    expect(event.message).toBe('Lookup failed for [email]');
  });
});
