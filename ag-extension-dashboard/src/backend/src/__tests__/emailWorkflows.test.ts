import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({
        query: jest.fn().mockResolvedValue({ rows: [{ count: 0 }], rowCount: 1 })
    })),
    query: jest.fn().mockResolvedValue({ rows: [{ count: 0 }], rowCount: 1 })
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => ({
        isOpen: true,
        get: jest.fn(),
        set: jest.fn()
    }))
}));

jest.mock('../services/prismaService', () => ({
    getPrisma: jest.fn(() => ({
        systemConfig: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue({})
        }
    }))
}));

jest.mock('../services/emailService', () => ({
    emailService: {
        sendEmail: jest.fn().mockResolvedValue(true)
    }
}));

// ---------------------------------------------------------------------------
// Helper – reference to the mocked query so we can control per-test behaviour
// ---------------------------------------------------------------------------
const { query: mockQuery } = jest.requireMock('../services/databaseService') as {
    query: jest.Mock;
    initializeDatabase: jest.Mock;
    getPool: jest.Mock;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Email Template Update – PUT /api/v1/email/templates/:id', () => {
    let adminToken: string;
    let officerToken: string;
    let farmerToken: string;

    const templateId = '00000000-0000-0000-0000-000000000001';
    const updatePayload = {
        subject: 'Updated Advisory Subject',
        body: '<p>This is the updated body content.</p>',
        category: 'advisory',
        variables: ['farmerName', 'cropType'],
    };

    beforeAll(() => {
        adminToken = jwt.sign(
            { userId: 'admin-1', role: 'admin', email: 'admin@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
        farmerToken = jwt.sign(
            { userId: 'farm-1', role: 'farmer', email: 'farmer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    // -----------------------------------------------------------------------
    // Authorisation
    // -----------------------------------------------------------------------
    it('should allow admin to update a template', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: templateId }], rowCount: 1 });

        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(updatePayload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Template updated successfully');
    });

    it('should allow extension_officer to update a template', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: templateId }], rowCount: 1 });

        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${officerToken}`)
            .send(updatePayload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Template updated successfully');
    });

    it('should deny farmer role with 403', async () => {
        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${farmerToken}`)
            .send(updatePayload);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should return 401 for unauthenticated request', async () => {
        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .send(updatePayload);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('No token provided');
    });

    // -----------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------
    it('should return 400 when body is empty', async () => {
        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toBeDefined();
        // The refine error fires when no field is present
        expect(response.body.details.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 when subject is empty string', async () => {
        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ subject: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details[0].path).toBe('subject');
    });

    it('should return 400 when body is empty string', async () => {
        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ body: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.details[0].path).toBe('body');
    });

    it('should return 400 when unknown fields are sent (strict mode)', async () => {
        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ subject: 'Valid', unknownField: 'should be rejected' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // strict() errors have path 'body.unrecognized_keys' or similar
        expect(response.body.details.length).toBeGreaterThanOrEqual(1);
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------
    it('should return 404 when template is not found', async () => {
        // Simulate no rows returned (template not found)
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(updatePayload);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Template not found');
    });

    it('should allow updating only subject (partial update)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: templateId }], rowCount: 1 });

        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ subject: 'Just the subject' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should allow updating only variables (partial update)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: templateId }], rowCount: 1 });

        const response = await request(app)
            .put(`/api/v1/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ variables: ['farmerName', 'cropType', 'region'] });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should work via legacy /api/email/templates/:id path', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: templateId }], rowCount: 1 });

        const response = await request(app)
            .put(`/api/email/templates/${templateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(updatePayload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
