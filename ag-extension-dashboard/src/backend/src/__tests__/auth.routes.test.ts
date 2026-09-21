import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import authRouter from '@/routes/auth';
import { query } from '@/services/databaseService';
import { verifyPassword } from '@/utils/password';

// Mock dependencies
jest.mock('@/services/databaseService');
jest.mock('@/utils/password');
jest.mock('@/middleware/validationMiddleware', () => ({
    validate: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('returns 400 when email or password missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Email and password are required');
        });

        it('returns 401 when user not found', async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
            mockVerifyPassword.mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nonexistent@example.com', password: 'password123' })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('returns 401 when password is invalid', async () => {
            mockQuery.mockResolvedValue({
                rows: [{
                    id: 'user-123',
                    email: 'test@example.com',
                    password_hash: '$2a$10$hash',
                    first_name: 'Test',
                    last_name: 'User',
                    role: 'extension_officer',
                    region: 'Kenya',
                    mfa_enabled: false,
                    is_demo: false,
                    lockout_until: null,
                }],
                rowCount: 1,
            });
            mockVerifyPassword.mockResolvedValue(false);
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // lockout query
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // login history

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid email or password');
        });

        it('returns 200 with token and user on successful login', async () => {
            mockQuery
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'user-123',
                        email: 'test@example.com',
                        password_hash: '$2a$10$hash',
                        first_name: 'Test',
                        last_name: 'User',
                        role: 'extension_officer',
                        region: 'Kenya',
                        mfa_enabled: false,
                        is_demo: false,
                        lockout_until: null,
                    }],
                    rowCount: 1,
                })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // lockout query
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // login history
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // subscription query

            mockVerifyPassword.mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'correctpassword' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user).toEqual(expect.objectContaining({
                id: 'user-123',
                email: 'test@example.com',
                role: 'extension_officer',
            }));
        });
    });

    describe('POST /api/auth/demo', () => {
        it('returns 404 when demo not enabled', async () => {
            // Test with demo disabled via config
            const res = await request(app)
                .post('/api/auth/demo')
                .expect(404);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Demo access is not enabled');
        });
    });
});