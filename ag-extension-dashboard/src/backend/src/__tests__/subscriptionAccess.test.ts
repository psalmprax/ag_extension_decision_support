import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';
import { authorize } from '@/middleware/authorize';
import { usageService } from '@/services/usageService';
import { query } from '@/services/databaseService';
import { hashToken } from '@/services/sessionService';
import visitsRouter from '@/routes/visits';
import analyticsRouter from '@/routes/analytics';
import worldmonitorRouter from '@/routes/worldmonitor';
import emailWorkflowsRouter from '@/routes/emailWorkflows';

jest.mock('@/services/databaseService', () => ({
  getPool: jest.fn(() => ({ query: jest.fn() })),
  query: jest.fn(),
}));
jest.mock('@/services/cacheService', () => ({
  getCache: jest.fn(() => null),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/usageService', () => ({
  usageService: {
    isFreeUser: jest.fn(),
  },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockQuery = query as jest.Mock;
const mockIsFreeUser = usageService.isFreeUser as jest.Mock;
const sessions = new Map<string, { userId: string }>();

function issueToken(claims: { userId: string; role: string; email?: string; isDemo?: boolean }): string {
  const token = jwt.sign(
    {
      userId: claims.userId,
      role: claims.role,
      email: claims.email ?? `${claims.userId}@example.com`,
      ...(claims.isDemo ? { isDemo: true } : {}),
      jti: randomUUID(),
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  sessions.set(hashToken(token), { userId: claims.userId });
  return token;
}

const app = express();
app.use(express.json());
app.get('/gated', authorize(['admin', 'extension_officer', 'farmer']), requirePaidPlan('Test Feature'), (_req: Request, res: Response) => {
  res.json({ success: true });
});
app.get('/gated-unauthenticated', requirePaidPlan('Field Visits'), (_req: Request, res: Response) => {
  res.json({ success: true });
});
app.use('/visits', visitsRouter);
app.use('/analytics', analyticsRouter);
app.use('/worldmonitor', worldmonitorRouter);
app.use('/email-workflows', emailWorkflowsRouter);

describe('requirePaidPlan & backend Pro route gating', () => {
  beforeEach(() => {
    sessions.clear();
    mockQuery.mockReset();
    mockIsFreeUser.mockReset();
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM user_sessions')) {
        const hit = sessions.get(String(params[0]));
        return {
          rows: hit ? [{ is_revoked: false, is_active: true, expires_at: new Date(Date.now() + 3600_000) }] : [],
          rowCount: hit ? 1 : 0,
        };
      }
      if (sql.includes('FROM tenants')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ total: '0', active: '0', avg_farm_size: '0', count: '0', avg_yield: '0', total_hectares: '0' }], rowCount: 1 };
    });
  });

  it('rejects unauthenticated requests at middleware boundary (401)', async () => {
    const res = await request(app).get('/gated-unauthenticated');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Authentication required' });
    expect(mockIsFreeUser).not.toHaveBeenCalled();
  });

  it('blocks free extension officers with 403 upgradeRequired on all newly gated Pro endpoints', async () => {
    mockIsFreeUser.mockResolvedValue(true);
    const officerToken = issueToken({ userId: 'off-free', role: 'extension_officer' });

    const visitsRes = await request(app).get('/visits').set('Authorization', `Bearer ${officerToken}`);
    expect(visitsRes.status).toBe(403);
    expect(visitsRes.body.upgradeRequired).toBe(true);

    const monitorRes = await request(app).get('/worldmonitor/layers').set('Authorization', `Bearer ${officerToken}`);
    expect(monitorRes.status).toBe(403);
    expect(monitorRes.body.upgradeRequired).toBe(true);

    const analyticsPerfRes = await request(app).get('/analytics/performance').set('Authorization', `Bearer ${officerToken}`);
    expect(analyticsPerfRes.status).toBe(403);
    expect(analyticsPerfRes.body.upgradeRequired).toBe(true);

    const workflowRes = await request(app).get('/email-workflows/templates').set('Authorization', `Bearer ${officerToken}`);
    expect(workflowRes.status).toBe(403);
    expect(workflowRes.body.upgradeRequired).toBe(true);
  });

  it('keeps Free core dashboard (/analytics/dashboard) unlocked for free users', async () => {
    mockIsFreeUser.mockResolvedValue(true);
    const officerToken = issueToken({ userId: 'off-free', role: 'extension_officer' });

    const dashRes = await request(app).get('/analytics/dashboard').set('Authorization', `Bearer ${officerToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.success).toBe(true);
  });

  it('allows admins without checking subscription table and allows upgraded Pro users', async () => {
    const adminToken = issueToken({ userId: 'admin-1', role: 'admin' });
    const adminRes = await request(app).get('/gated').set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(mockIsFreeUser).not.toHaveBeenCalled();

    mockIsFreeUser.mockResolvedValue(false);
    const proOfficerToken = issueToken({ userId: 'off-pro', role: 'extension_officer' });
    const proRes = await request(app).get('/gated').set('Authorization', `Bearer ${proOfficerToken}`);
    expect(proRes.status).toBe(200);
    expect(mockIsFreeUser).toHaveBeenCalledWith('off-pro', 'extension_officer');
  });

  it('allows demo principals through requirePaidPlan', async () => {
    const demoToken = issueToken({ userId: 'demo-user', role: 'extension_officer', isDemo: true, email: 'demo@agridemo.com' });
    const res = await request(app).get('/gated').set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(mockIsFreeUser).not.toHaveBeenCalled();
  });

  it('fails closed (503) if subscription verification throws', async () => {
    mockIsFreeUser.mockRejectedValue(new Error('DB down'));
    const officerToken = issueToken({ userId: 'off-err', role: 'extension_officer' });
    const res = await request(app).get('/gated').set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});
