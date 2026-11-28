import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { hashToken } from '@/services/sessionService';
import { isSystemAdminUser } from '@/services/systemAdminService';
import { grantServiceAccess, listServiceAccess, revokeServiceAccess } from '@/services/serviceAccessService';
import serviceAccessRouter from '@/routes/serviceAccess';

jest.mock('@/services/databaseService', () => ({ getPool: jest.fn(() => null), query: jest.fn() }));
jest.mock('@/services/cacheService', () => ({ getCache: jest.fn(() => null), cacheGet: jest.fn().mockResolvedValue(null), cacheSet: jest.fn() }));
jest.mock('@/services/systemAdminService', () => ({ isSystemAdminUser: jest.fn() }));
jest.mock('@/services/serviceAccessService', () => ({
  listServiceAccess: jest.fn().mockResolvedValue([]),
  grantServiceAccess: jest.fn().mockResolvedValue(undefined),
  revokeServiceAccess: jest.fn(),
}));
jest.mock('@/middleware/auditMiddleware', () => ({ auditMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const SYSTEM_ADMIN = randomUUID();
const TENANT_ADMIN = randomUUID();
const FARMER = randomUUID();
const OFFICER = randomUUID();
const ROLES: Record<string, string> = { [SYSTEM_ADMIN]: 'admin', [TENANT_ADMIN]: 'admin', [FARMER]: 'farmer', [OFFICER]: 'extension_officer' };
const sessions = new Set<string>();

function tokenFor(userId: string): string {
  const token = jwt.sign({ userId, role: ROLES[userId], email: `${userId}@example.com`, jti: randomUUID() }, config.jwt.secret, { expiresIn: '1h' });
  sessions.add(hashToken(token));
  return `Bearer ${token}`;
}

const app = express();
app.use(express.json());
app.use('/users', serviceAccessRouter);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isSystemAdminUser).mockImplementation(async id => id === SYSTEM_ADMIN);
  jest.mocked(query).mockImplementation((async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM user_sessions')) {
      const hit = sessions.has(String(params[0]));
      return { rows: hit ? [{ is_revoked: false, is_active: true, expires_at: new Date(Date.now() + 3600_000) }] : [], rowCount: hit ? 1 : 0 };
    }
    if (sql.includes('SELECT role FROM users')) {
      const role = ROLES[String(params[0])];
      return { rows: role ? [{ role }] : [], rowCount: role ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }) as unknown as typeof query);
});

describe('service access granted by the system administrator', () => {
  it('lists the services a Free farmer can be given', async () => {
    const res = await request(app).get(`/users/${FARMER}/service-access`).set('Authorization', tokenFor(SYSTEM_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.grantable.map((s: { service: string }) => s.service)).toEqual(['chat', 'field_visits', 'knowledge_ai', 'fields']);
  });

  it('grants a service with an end date and note', async () => {
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const res = await request(app)
      .put(`/users/${FARMER}/service-access/chat`)
      .set('Authorization', tokenFor(SYSTEM_ADMIN))
      .send({ expiresAt: until, note: 'Cooperative pilot' });
    expect(res.status).toBe(200);
    expect(grantServiceAccess).toHaveBeenCalledWith({
      userId: FARMER, service: 'chat', grantedBy: SYSTEM_ADMIN, expiresAt: new Date(until), note: 'Cooperative pilot',
    });
    expect(listServiceAccess).toHaveBeenCalledWith(FARMER);
  });

  it('refuses other admins, officers and farmers', async () => {
    for (const actor of [TENANT_ADMIN, OFFICER, FARMER]) {
      const res = await request(app).put(`/users/${FARMER}/service-access/chat`).set('Authorization', tokenFor(actor)).send({});
      expect(res.status).toBe(403);
    }
    expect(grantServiceAccess).not.toHaveBeenCalled();
  });

  it('refuses a service that does not suit the account, an unknown service and a past end date', async () => {
    const admin = tokenFor(SYSTEM_ADMIN);
    const wrongRole = await request(app).put(`/users/${FARMER}/service-access/analytics`).set('Authorization', admin).send({});
    expect(wrongRole.status).toBe(400);
    const unknown = await request(app).put(`/users/${FARMER}/service-access/teleportation`).set('Authorization', admin).send({});
    expect(unknown.status).toBe(400);
    const past = await request(app).put(`/users/${FARMER}/service-access/chat`).set('Authorization', admin).send({ expiresAt: '2020-01-01T00:00:00Z' });
    expect(past.status).toBe(400);
    const missing = await request(app).put(`/users/${randomUUID()}/service-access/chat`).set('Authorization', admin).send({});
    expect(missing.status).toBe(404);
    expect(grantServiceAccess).not.toHaveBeenCalled();
  });

  it('revokes an active grant, and says so when there is none', async () => {
    const admin = tokenFor(SYSTEM_ADMIN);
    jest.mocked(revokeServiceAccess).mockResolvedValueOnce(true);
    const revoked = await request(app).delete(`/users/${FARMER}/service-access/chat`).set('Authorization', admin);
    expect(revoked.status).toBe(200);
    expect(revokeServiceAccess).toHaveBeenCalledWith(FARMER, 'chat', SYSTEM_ADMIN);

    jest.mocked(revokeServiceAccess).mockResolvedValueOnce(false);
    const none = await request(app).delete(`/users/${FARMER}/service-access/chat`).set('Authorization', admin);
    expect(none.status).toBe(404);
  });
});
