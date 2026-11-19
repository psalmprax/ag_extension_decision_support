import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { hashToken } from '@/services/sessionService';
import { voucherService } from '@/services/voucherService';
import { transactionService } from '@/services/transactionService';
import voucherRoutes from '@/routes/billing/voucher';
import transactionRoutes from '@/routes/billing/transactions';

jest.mock('@/services/databaseService', () => ({ getPool: jest.fn(() => ({})), query: jest.fn() }));
jest.mock('@/services/cacheService', () => ({ getCache: jest.fn(() => null) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/voucherService', () => ({ voucherService: { generateVouchers: jest.fn() } }));
jest.mock('@/services/transactionService', () => ({
  transactionService: { verifyTransaction: jest.fn(), rejectTransaction: jest.fn() },
}));

const mockQuery = jest.mocked(query);
const SYSTEM_ADMIN = 'sys-admin';
const ORDINARY_ADMIN = 'ordinary-admin';
const sessions = new Set<string>();

function adminToken(userId: string): string {
  const token = jwt.sign({ userId, email: `${userId}@example.test`, role: 'admin', jti: randomUUID() }, config.jwt.secret, {
    expiresIn: '1h',
  });
  sessions.add(hashToken(token));
  return token;
}

const app = express();
app.use(express.json());
app.use('/billing', voucherRoutes);
app.use('/billing', transactionRoutes);

beforeEach(() => {
  sessions.clear();
  jest.clearAllMocks();
  mockQuery.mockImplementation((async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM user_sessions')) {
      const known = sessions.has(String(params[0]));
      return { rows: known ? [{ is_revoked: false, is_active: true, expires_at: new Date(Date.now() + 3_600_000) }] : [], rowCount: known ? 1 : 0 };
    }
    if (sql.includes('SELECT is_system_admin FROM users')) {
      return { rows: [{ is_system_admin: params[0] === SYSTEM_ADMIN }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }) as unknown as typeof query);
  jest.mocked(voucherService.generateVouchers).mockResolvedValue({ success: true, vouchers: [] } as never);
  jest.mocked(transactionService.verifyTransaction).mockResolvedValue({ success: true, message: 'verified' } as never);
  jest.mocked(transactionService.rejectTransaction).mockResolvedValue({ success: true, message: 'rejected' } as never);
});

/** Each of these gives an account a paid plan without a card payment (or decides one). */
const MANUAL_GRANTS = [
  { name: 'mint vouchers', path: '/billing/voucher/generate', body: { planId: 'plan-pro', count: 2 } },
  { name: 'approve a manual payment', path: '/billing/transaction/verify/tx-1', body: {} },
  { name: 'reject a manual payment', path: '/billing/transaction/reject/tx-1', body: { reason: 'Mismatched amount' } },
];

describe('manual plan grants are reserved for the system administrator', () => {
  it.each(MANUAL_GRANTS)('an ordinary admin cannot $name', async ({ path, body }) => {
    const res = await request(app).post(path).set('Authorization', `Bearer ${adminToken(ORDINARY_ADMIN)}`).send(body);

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('SYSTEM_ADMIN_REQUIRED');
    expect(voucherService.generateVouchers).not.toHaveBeenCalled();
    expect(transactionService.verifyTransaction).not.toHaveBeenCalled();
    expect(transactionService.rejectTransaction).not.toHaveBeenCalled();
  });

  it.each(MANUAL_GRANTS)('the system administrator can $name', async ({ path, body }) => {
    const res = await request(app).post(path).set('Authorization', `Bearer ${adminToken(SYSTEM_ADMIN)}`).send(body);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body.success).toBe(true);
  });
});
