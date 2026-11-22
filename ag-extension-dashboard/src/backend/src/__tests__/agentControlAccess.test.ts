/** Starting, stopping and listing the agent services is for administrators only. */
jest.mock('../services/databaseService', () => ({
  initializeDatabase: jest.fn(),
  getPool: jest.fn(() => ({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) })),
  query: jest.fn(async (sql: string) => ({
    rows: sql.includes('FROM user_sessions') ? [{ is_revoked: false, is_active: true, expires_at: '2099-01-01T00:00:00Z' }] : [],
    rowCount: 1,
  })),
}));
// Every Prisma model method answers "nothing on record".
jest.mock('../services/prismaService', () => {
  const model = new Proxy({}, { get: () => jest.fn().mockResolvedValue(null) });
  const client = new Proxy({}, { get: () => model });
  return { getPrisma: () => client };
});
jest.mock('../services/cacheService', () => ({
  initializeCache: jest.fn(),
  getCache: jest.fn(() => ({ isOpen: true, get: jest.fn(), set: jest.fn() })),
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() },
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config';

const tokenFor = (role: string) => jwt.sign({ userId: `${role}-1`, role, email: `${role}@example.com` }, config.jwt.secret, { expiresIn: '1h' });

describe('agent control routes', () => {
  it.each(['farmer', 'extension_officer', 'regional_manager'])('refuses a %s', async role => {
    const auth = { Authorization: `Bearer ${tokenFor(role)}` };
    expect((await request(app).get('/api/v1/ai/agents').set(auth)).status).toBe(403);
    expect((await request(app).get('/api/v1/ai/status').set(auth)).status).toBe(403);
    expect((await request(app).post('/api/v1/ai/execute').set(auth).send({ agent: 'agent-zero' })).status).toBe(403);
    expect((await request(app).post('/api/v1/ai/stop/agent-zero').set(auth)).status).toBe(403);
    expect((await request(app).get('/api/v1/ai/agents/queue').set(auth)).status).toBe(403);
    expect((await request(app).get('/api/v1/ai/agents/handoffs').set(auth)).status).toBe(403);
    expect((await request(app).post('/api/v1/ai/agents/dispatch').set(auth).send({ type: 'ai.execute', payload: {} })).status).toBe(403);
  });
});
