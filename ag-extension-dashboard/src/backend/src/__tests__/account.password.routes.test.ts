import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import accountRouter from '@/routes/account';
import { query } from '@/services/databaseService';
import { verifyPassword } from '@/utils/password';
import { passwordProblems } from '@/utils/passwordPolicy';
import { revokeAllUserSessions } from '@/services/sessionService';

jest.mock('@/services/databaseService');
jest.mock('@/utils/password', () => ({ verifyPassword: jest.fn() }));
jest.mock('@/utils/passwordPolicy', () => ({ passwordProblems: jest.fn() }));
jest.mock('@/services/sessionService', () => ({
    revokeAllUserSessions: jest.fn(),
    withUserSessionLock: (_userId: string, callback: (client: { query: typeof query }) => Promise<unknown>) =>
        callback({ query: (...args: Parameters<typeof query>) => mockQuery(...args) }),
}));
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: Request, _res: Response, next: NextFunction) => {
        req.user = { userId: 'user-1', email: 'user@example.com', role: 'extension_officer' };
        next();
    },
}));
jest.mock('@/middleware/validationMiddleware', () => ({
    validate: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/middleware/auditMiddleware', () => ({
    auditMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockPasswordProblems = passwordProblems as jest.MockedFunction<typeof passwordProblems>;
const mockRevokeAllUserSessions = revokeAllUserSessions as jest.MockedFunction<typeof revokeAllUserSessions>;

const app = express();
app.use(express.json());
app.use('/api/v1/account', accountRouter);

describe('POST /api/v1/account/password', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPasswordProblems.mockReturnValue([]);
    });

    it('updates the password only after verifying the current password and revokes sessions', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ password_hash: 'stored-hash', email: 'user@example.com' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });
        mockVerifyPassword.mockResolvedValue(true);

        const response = await request(app)
            .post('/api/v1/account/password')
            .send({ currentPassword: 'old-password', newPassword: 'StrongPass123' })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Sign in again');
        expect(mockVerifyPassword).toHaveBeenCalledWith('old-password', 'stored-hash');
        expect(mockPasswordProblems).toHaveBeenCalledWith('StrongPass123', 'user@example.com');
        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(mockRevokeAllUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('rejects an incorrect current password without changing the stored password', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ password_hash: 'stored-hash', email: 'user@example.com' }],
            rowCount: 1,
        });
        mockVerifyPassword.mockResolvedValue(false);

        await request(app)
            .post('/api/v1/account/password')
            .send({ currentPassword: 'wrong-password', newPassword: 'StrongPass123' })
            .expect(400);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
    });

    it('returns a validation error when account deletion password confirmation is incorrect', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ password_hash: await bcrypt.hash('correct-password', 4), role: 'extension_officer', email: 'user@example.com' }],
            rowCount: 1,
        });

        await request(app)
            .delete('/api/v1/account')
            .send({ password: 'incorrect-password', confirm: 'DELETE MY ACCOUNT' })
            .expect(400);

    });
});
