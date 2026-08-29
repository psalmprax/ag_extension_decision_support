import request from 'supertest';
import app from '../app';
import { makeOfficerToken } from './helpers/setupMocks';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
    initializeDatabase: jest.fn(),
    getCache: jest.fn(() => null),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Use admin role to bypass role-based filtering (extension_officer would add
// a WHERE clause that depends on farmers.assigned_officer_id)
jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
        if (!req.headers?.authorization) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        req.user = { userId: 'admin-1', role: 'admin', email: 'admin@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

jest.mock('../middleware/validationMiddleware', () => ({
    validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../services/bulkOperationsService', () => ({
    bulkOperationsService: {
        bulkDeleteVisits: jest.fn().mockResolvedValue({ deleted: 0 }),
    },
}));

import { query, getPool } from '../services/databaseService';
const mockQuery = query as jest.Mock;
const mockGetPool = getPool as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Visits Route — Mapper-before-response: mapVisitWithFarmerRows + mapVisitWithFarmerRow + mapVisitInsertRow + mapVisitIdRow', () => {
    let adminToken: string;

    beforeAll(() => {
        adminToken = makeOfficerToken({ userId: 'admin-1', role: 'admin' });
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('GET / returns camelCase VisitWithFarmerDTO[] from snake_case rows', async () => {
        const visitRow = {
            id: 'visit-1',
            officer_id: 'off-1',
            farmer_id: 'farm-uuid-1',
            visit_type: 'routine',
            status: 'scheduled',
            scheduled_at: '2024-12-20T10:00:00Z',
            started_at: null,
            completed_at: null,
            duration_minutes: 45,
            location_lat: '-13.9626',
            location_lng: '33.7741',
            notes: 'Routine check',
            outcomes: null,
            follow_up_required: false,
            follow_up_date: null,
            reminder_sent: false,
            overdue_alert_sent: false,
            follow_up_reminder_sent: false,
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
            farmer_name: 'John Tembo',
        };
        mockQuery.mockResolvedValueOnce({ rows: [visitRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/visits')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        const first = response.body.data.visits[0];
        // snake_case → camelCase
        expect(first.id).toBe('visit-1');
        expect(first.officerId).toBe('off-1');
        expect(first.farmerId).toBe('farm-uuid-1');
        expect(first.visitType).toBe('routine');
        expect(first.scheduledAt).toBe('2024-12-20T10:00:00Z');
        expect(first.durationMinutes).toBe(45);
        expect(first.locationLat).toBeCloseTo(-13.9626);
        expect(first.locationLng).toBeCloseTo(33.7741);
        expect(first.followUpRequired).toBe(false);
        expect(first.followUpDate).toBeNull();
        expect(first.reminderSent).toBe(false);
        expect(first.overdueAlertSent).toBe(false);
        expect(first.followUpReminderSent).toBe(false);
        expect(first.createdAt).toBe('2024-12-15T10:00:00Z');
        expect(first.farmerName).toBe('John Tembo');
        // Must NOT leak snake_case
        expect(first.officer_id).toBeUndefined();
        expect(first.farmer_id).toBeUndefined();
        expect(first.visit_type).toBeUndefined();
        expect(first.scheduled_at).toBeUndefined();
        expect(first.duration_minutes).toBeUndefined();
        expect(first.location_lat).toBeUndefined();
        expect(first.follow_up_required).toBeUndefined();
    });

    it('GET /:id returns camelCase VisitWithFarmerDTO from snake_case row', async () => {
        const visitRow = {
            id: 'visit-1',
            officer_id: 'off-1',
            farmer_id: 'farm-uuid-1',
            visit_type: 'routine',
            status: 'completed',
            scheduled_at: '2024-12-20T10:00:00Z',
            started_at: '2024-12-20T10:05:00Z',
            completed_at: '2024-12-20T10:50:00Z',
            duration_minutes: 45,
            location_lat: null,
            location_lng: null,
            notes: 'Done',
            outcomes: 'Healthy crop',
            follow_up_required: true,
            follow_up_date: '2025-01-20T10:00:00Z',
            reminder_sent: true,
            overdue_alert_sent: false,
            follow_up_reminder_sent: false,
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
            farmer_name: 'Jane Banda',
        };
        mockQuery.mockResolvedValueOnce({ rows: [visitRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/visits/visit-1')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe('visit-1');
        expect(response.body.data.startedAt).toBe('2024-12-20T10:05:00Z');
        expect(response.body.data.completedAt).toBe('2024-12-20T10:50:00Z');
        expect(response.body.data.outcomes).toBe('Healthy crop');
        expect(response.body.data.followUpRequired).toBe(true);
        expect(response.body.data.followUpDate).toBe('2025-01-20T10:00:00Z');
        expect(response.body.data.reminderSent).toBe(true);
        expect(response.body.data.farmerName).toBe('Jane Banda');
        expect(response.body.data.started_at).toBeUndefined();
        expect(response.body.data.completed_at).toBeUndefined();
        expect(response.body.data.follow_up_required).toBeUndefined();
    });

    it('POST / invokes mapVisitInsertRow on the INSERT ... RETURNING row', async () => {
        const insertedRow = {
            id: 'visit-new',
            officer_id: 'off-1',
            farmer_id: 'farm-uuid-1',
            visit_type: 'routine',
            status: 'scheduled',
            scheduled_at: '2024-12-20T10:00:00Z',
            started_at: null,
            completed_at: null,
            duration_minutes: null,
            location_lat: null,
            location_lng: null,
            notes: 'New visit',
            outcomes: null,
            follow_up_required: false,
            follow_up_date: null,
            reminder_sent: false,
            overdue_alert_sent: false,
            follow_up_reminder_sent: false,
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };
        // performInsertVisit looks up the farmer's tenant/assigned-officer context first.
        mockQuery.mockResolvedValueOnce({
            rows: [{ tenant_id: null, assigned_officer_id: null }],
            rowCount: 1,
        });
        mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/visits')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ farmerId: 'farm-uuid-1', scheduledAt: '2024-12-20T10:00:00Z' });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe('visit-new');
        expect(response.body.data.visitType).toBe('routine');
        expect(response.body.data.scheduledAt).toBe('2024-12-20T10:00:00Z');
        expect(response.body.data.followUpRequired).toBe(false);
        expect(response.body.data.reminderSent).toBe(false);
        expect(response.body.data.visit_type).toBeUndefined();
        expect(response.body.data.scheduled_at).toBeUndefined();
    });

    it('POST /location invokes mapVisitIdRow on the INSERT ... RETURNING id', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'visit-loc-1' }], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/visits/location')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ latitude: -13.9626, longitude: 33.7741, accuracy: 10, accuracyStatus: 'high' });

        expect(response.status).toBe(200);
        // mapVisitIdRow: { id: row.id } — the response wraps it under .data.visitId
        expect(response.body.data.visitId).toBe('visit-loc-1');
    });
});
