const redis = {
  isOpen: true,
  hIncrBy: jest.fn(async () => 1),
  expire: jest.fn(async () => true),
  hSet: jest.fn(async () => 1),
  hGetAll: jest.fn(async (): Promise<Record<string, string>> => ({})),
};
jest.mock('@/services/cacheService', () => ({ getCache: () => redis }));

import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { __resetFailureMonitorForTests, failureSummary, recordFailure } from '@/services/failureMonitor';
import monitoringRoutes from '@/routes/monitoring';

describe('failure counts kept in Redis', () => {
  beforeEach(() => {
    __resetFailureMonitorForTests();
    jest.clearAllMocks();
  });

  it('does not count a failure twice when Redis counted it but could not set its expiry', async () => {
    redis.expire.mockRejectedValueOnce(new Error('READONLY'));
    await recordFailure('server', 'GET', '/api/weather', 502);
    redis.isOpen = false;
    try {
      expect(await failureSummary(1)).toEqual([]);
    } finally {
      redis.isOpen = true;
    }
    expect(redis.hIncrBy).toHaveBeenCalledTimes(1);
  });

  it('counts locally when Redis could not count at all', async () => {
    redis.hIncrBy.mockRejectedValueOnce(new Error('ECONNRESET'));
    await recordFailure('server', 'GET', '/api/weather', 502);
    redis.isOpen = false;
    try {
      expect(await failureSummary(1)).toMatchObject([{ route: '/api/weather', count: 1 }]);
    } finally {
      redis.isOpen = true;
    }
  });

  it('hands a failed summary read to the error handler instead of leaving the request open', async () => {
    process.env.MONITORING_TOKEN = 'a-monitoring-token-of-32-characters';
    redis.hGetAll.mockRejectedValueOnce(new Error('ECONNRESET'));
    const app = express();
    app.use('/api/v1/monitoring', monitoringRoutes);
    app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ success: false, error: error.message });
    });
    const res = await request(app).get('/api/v1/monitoring/failures').set('x-monitoring-token', process.env.MONITORING_TOKEN);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('ECONNRESET');
    delete process.env.MONITORING_TOKEN;
  });
});
