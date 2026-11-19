import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

jest.mock('@/services/databaseService', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/middleware/auditMiddleware', () => ({
    auditMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
// Validation is exercised by schema tests; here the route behaviour is under test.
jest.mock('@/middleware/validationMiddleware', () => ({
    validate: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('bcryptjs', () => {
    const hash = jest.fn(async () => '$2a$12$testhash');
    return { __esModule: true, default: { hash }, hash };
});
jest.mock('@/services/sessionService', () => ({ createSession: jest.fn(async () => undefined) }));
jest.mock('@/routes/auth/passwordReset', () => ({
    issueEmailVerification: jest.fn(async () => undefined),
}));

// The register router alone: the auth index also mounts the MFA and session
// routers, whose dependencies are irrelevant here and would have to be mocked.
import registerRouter from '@/routes/auth/register';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

interface ManagerRow {
    id: string;
    region: string | null;
    country: string | null;
}

const mockQuery = query as jest.MockedFunction<typeof query>;

const app = express();
app.use(express.json());
app.use('/api/auth', registerRouter);

const insertedRow = {
    id: 'user-new',
    email: 'officer@example.com',
    first_name: 'Amina',
    last_name: 'Otieno',
    role: 'extension_officer',
    region: 'Lilongwe',
    phone: '+265991234567',
};

/** Answers each query the register handler issues, keyed by the statement it runs. */
function installDb(managers: ManagerRow[]): void {
    mockQuery.mockImplementation((async (sql: string) => {
        if (/INSERT INTO users/i.test(sql)) return { rows: [insertedRow], rowCount: 1 };
        if (/role = 'regional_manager'/i.test(sql)) return { rows: managers, rowCount: managers.length };
        if (/FROM subscription_plans/i.test(sql)) return { rows: [{ id: 'plan-free' }], rowCount: 1 };
        if (/INSERT INTO subscriptions/i.test(sql)) return { rows: [{ id: 'sub-1' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
    }) as unknown as typeof query);
}

const officerSignup = (overrides: Record<string, unknown> = {}) => ({
    email: 'officer@example.com',
    password: 'Harvest2026',
    firstName: 'Amina',
    lastName: 'Otieno',
    role: 'extension_officer',
    country: 'Malawi',
    region: 'Lilongwe',
    ...overrides,
});

function userInsertParams(): unknown[] {
    const call = mockQuery.mock.calls.find(([sql]) => /INSERT INTO users/i.test(String(sql)));
    if (!call) throw new Error('the register handler never inserted a user');
    return call[1] as unknown[];
}

describe('POST /api/auth/register', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('stores the legacy phoneNumber field as phone and links the officer to their regional manager', async () => {
        installDb([{ id: 'rm-lilongwe', region: 'Lilongwe', country: 'Malawi' }]);

        const res = await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ phoneNumber: '+265991234567' }))
            .expect(201);

        const params = userInsertParams();
        expect(params[5]).toBe('Lilongwe'); // region
        expect(params[6]).toBe('Malawi'); // country
        expect(params[7]).toBe('+265991234567'); // phone (from phoneNumber)
        expect(params[8]).toBe('rm-lilongwe'); // manager_id

        expect(res.body.success).toBe(true);
        expect(res.body.data.managerAssigned).toBe(true);
        expect(res.body.data.user).toMatchObject({
            email: 'officer@example.com',
            role: 'extension_officer',
            region: 'Lilongwe',
            country: 'Malawi',
        });
    });

    it('accepts the current phone field as well', async () => {
        installDb([{ id: 'rm-lilongwe', region: 'Lilongwe', country: 'Malawi' }]);

        await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ phone: '+265991111111' }))
            .expect(201);

        expect(userInsertParams()[7]).toBe('+265991111111');
    });

    it('bridges the country-list region spelling to the manager region', async () => {
        installDb([{ id: 'rm-lilongwe', region: 'Lilongwe', country: 'Malawi' }]);

        await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ region: 'Central Region (Lilongwe)' }))
            .expect(201);

        expect(userInsertParams()[8]).toBe('rm-lilongwe');
    });

    it('still creates the account when no regional manager covers the region', async () => {
        installDb([]);

        const res = await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ region: 'Nairobi' }))
            .expect(201);

        expect(userInsertParams()[8]).toBeNull();
        expect(res.body.data.managerAssigned).toBe(false);
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('no regional manager matched region "Nairobi"')
        );
    });

    it('leaves farmers unassigned and never looks up a manager for them', async () => {
        installDb([{ id: 'rm-lilongwe', region: 'Lilongwe', country: 'Malawi' }]);

        await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ role: 'farmer', email: 'farmer@example.com' }))
            .expect(201);

        expect(userInsertParams()[8]).toBeNull();
        const lookedUpManager = mockQuery.mock.calls.some(([sql]) => /regional_manager/.test(String(sql)));
        expect(lookedUpManager).toBe(false);
    });

    it('refuses self-registration as an admin', async () => {
        installDb([]);

        const res = await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ role: 'admin' }))
            .expect(403);

        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('not available for self-registration');
        expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO users/i.test(String(sql)))).toBe(false);
    });

    it('rejects a weak password before touching the database', async () => {
        installDb([]);

        await request(app)
            .post('/api/auth/register')
            .send(officerSignup({ password: 'short' }))
            .expect(400);

        expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO users/i.test(String(sql)))).toBe(false);
    });
});
