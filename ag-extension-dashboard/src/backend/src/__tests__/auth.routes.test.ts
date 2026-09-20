import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import authRouter from '@/routes/auth';
import { query } from '@/services/databaseService';
import { verifyPassword } from '@/utils/password';
import { validate } from '@/middleware/validationMiddleware';

// Mock dependencies
jest.mock('@/services/databaseService');
jest.mock('@/utils/password');
jest.mock('@/middleware/validationMiddleware', () => ({
    validate: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

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
            (query as jest.Mock).mockResolvedValue({ rows: [] });
            (verifyPassword as jest.Mock).mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nonexistent@example.com', password: 'password123' })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('returns 401 when password is invalid', async () => {
            (query as jest.Mock).mockResolvedValue({
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
                }]
            });
            (verifyPassword as jest.Mock).mockResolvedValue(false);
            (query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // lockout query
            (query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // login history

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid email or password');
        });

        it('returns 200 with token and user on successful login', async () => {
            (query as jest.Mock)
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
                    }]
                })
                .mockResolvedValueOnce({ rows: [] }) // lockout query
                .mockResolvedValueOnce({ rows: [] }) // login history
                .mockResolvedValueOnce({ rows: [] }); // subscription query

            (verifyPassword as jest.Mock).mockResolvedValue(true);

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