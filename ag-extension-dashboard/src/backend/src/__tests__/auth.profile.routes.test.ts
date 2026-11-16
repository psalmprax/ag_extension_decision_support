import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import sessionRouter from '@/routes/auth/session';
import { query } from '@/services/databaseService';

jest.mock('@/services/databaseService');
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: Request, _res: Response, next: NextFunction) => {
        req.user = { userId: 'user-1', email: 'user@example.com', role: 'extension_officer' };
        next();
    },
}));
jest.mock('@/middleware/auditMiddleware', () => ({
    auditMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const app = express();
app.use(express.json());
app.use('/api/auth', sessionRouter);

describe('PATCH /api/auth/me', () => {
    beforeEach(() => jest.clearAllMocks());

    it('persists only editable identity and contact fields for the authenticated user', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: 'user-1',
                email: 'user@example.com',
                first_name: 'Jordan',
                last_name: 'Farmer',
                role: 'extension_officer',
                region: 'Nakuru',
                phone: '+254700000000',
            }],
            rowCount: 1,
        });

        const response = await request(app)
            .patch('/api/auth/me')
            .send({ firstName: 'Jordan', lastName: 'Farmer', phone: '+254700000000' })
            .expect(200);

        expect(response.body.data).toMatchObject({
            id: 'user-1',
            firstName: 'Jordan',
            lastName: 'Farmer',
            phone: '+254700000000',
            region: 'Nakuru',
        });
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET first_name = $1, last_name = $2, phone = $3'),
            ['Jordan', 'Farmer', '+254700000000', 'user-1']
        );
    });

    it('saves an alert channel choice by merging it into the stored preferences', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: 'user-1', email: 'user@example.com', first_name: 'Jordan', last_name: 'Farmer',
                role: 'extension_officer', region: 'Nakuru', phone: null,
                notification_preferences: { emailAlerts: true, smsAlerts: false },
            }],
            rowCount: 1,
        });

        const response = await request(app)
            .patch('/api/auth/me')
            .send({ notificationPreferences: { smsAlerts: false } })
            .expect(200);

        expect(response.body.data.notificationPreferences).toEqual({ emailAlerts: true, smsAlerts: false });
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain(`notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || $1::jsonb`);
        expect(params).toEqual([JSON.stringify({ smsAlerts: false }), 'user-1']);
    });

    it('rejects unknown or non-boolean alert preferences', async () => {
        await request(app).patch('/api/auth/me').send({ notificationPreferences: { smsAlerts: 'no' } }).expect(400);
        await request(app).patch('/api/auth/me').send({ notificationPreferences: { marketingCalls: true } }).expect(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects authorization and other protected fields in self-service profile updates', async () => {
        await request(app)
            .patch('/api/auth/me')
            .send({ region: 'another region' })
            .expect(400);

        await request(app)
            .patch('/api/auth/me')
            .send({ email: 'changed@example.com', role: 'admin' })
            .expect(400);

        expect(mockQuery).not.toHaveBeenCalled();
    });
});
