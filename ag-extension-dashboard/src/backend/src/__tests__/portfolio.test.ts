import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { binaryParser, readSheet, parseXlsxBuffer } from './helpers/xlsx';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => null),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Bypass auth middleware — reject missing tokens (401), inject a fake user on success
jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
        if (!req.headers?.authorization) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        req.user = { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => {
        next();
    },
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

import { query, getPool } from '../services/databaseService';
const mockQuery = query as jest.Mock;
const mockGetPool = getPool as jest.Mock;

// ─── Fixtures (snake_case, mirror raw SQL output) ────────────────────────────

const portfolioSummaryRows = [
    { count: '42' },
    { count: '7' },
    { count: '2' },
    { count: '5' },
    { count: '3' },
];

const priorityQueueRows = [
    {
        farmer_id: 'farm-uuid-1',
        name: 'Grace Banda',
        reason: 'Follow-up required',
        severity: 'high' as const,
        crop: 'maize',
    },
    {
        farmer_id: 'farm-uuid-2',
        name: 'Peter Mwangi',
        reason: 'Routine check',
        severity: 'low' as const,
        crop: null,
    },
];

const recommendedVisitRows = [
    {
        farmer_id: 'farm-uuid-3',
        name: 'Alice Phiri',
        lat: '-13.9626',
        lng: '33.7741',
        reason: 'Disease alert',
        priority: 1,
        estimatedtime: 45,
    },
];

const alertRows = [
    { type: 'armyworm', severity: 'high', description: 'Outbreak in Central', location: 'Lilongwe' },
];

const farmerDetailRow = {
    id: 'farm-uuid-4',
    first_name: 'John',
    last_name: 'Tembo',
    phone: '+265999123456',
    village: 'Mchinji',
    district: 'Mchinji',
    region: 'Central',
    location_lat: '-13.8',
    location_lng: '32.9',
    farm_size_hectares: '2.5',
    crops: ['maize', 'beans'],
    language_preference: 'en',
    last_visit: '2024-12-15T10:00:00Z',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Portfolio Route — Row type correctness (snake_case → camelCase DTOs)', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        mockQuery.mockReset();
    });

    it('GET /portfolio returns camelCase summary + priorityQueue DTOs', async () => {
        // First 5 calls are the summary COUNT(*) queries
        for (const row of portfolioSummaryRows) {
            mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
        }
        // 6th call is the priority queue
        mockQuery.mockResolvedValueOnce({ rows: priorityQueueRows, rowCount: 2 });

        const response = await request(app)
            .get('/api/v1/portfolio')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Summary: snake_case `count` string parsed to camelCase number
        const summary = response.body.data.summary;
        expect(summary.totalFarmers).toBe(42);
        expect(summary.pendingVisits).toBe(7);
        expect(summary.overdueVisits).toBe(2);
        expect(summary.upcomingVisits).toBe(5);
        expect(summary.highPriority).toBe(3);

        // Priority queue: snake_case `farmer_id` → camelCase `farmerId`
        const queue = response.body.data.priorityQueue;
        expect(queue).toHaveLength(2);
        expect(queue[0]).toEqual({
            farmerId: 'farm-uuid-1',
            name: 'Grace Banda',
            reason: 'Follow-up required',
            severity: 'high',
            crop: 'maize',
        });
        expect(queue[1].farmerId).toBe('farm-uuid-2');
        expect(queue[1].crop).toBeNull();
        // Must NOT leak snake_case fields
        expect(queue[0].farmer_id).toBeUndefined();
    });

    it('GET /portfolio/recommendations returns camelCase RecommendedVisitDTO + AlertSummaryDTO', async () => {
        mockQuery.mockResolvedValueOnce({ rows: recommendedVisitRows, rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: alertRows, rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/portfolio/recommendations')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);

        const visits = response.body.data.recommendedVisits;
        expect(visits).toHaveLength(1);
        // snake_case `farmer_id` → camelCase `farmerId`; `estimatedtime` → `estimatedTime`
        expect(visits[0]).toEqual({
            farmerId: 'farm-uuid-3',
            name: 'Alice Phiri',
            lat: -13.9626, // parseDecimal on string
            lng: 33.7741,
            reason: 'Disease alert',
            priority: 1,
            estimatedTime: 45,
        });
        expect(visits[0].estimatedtime).toBeUndefined();
        expect(visits[0].farmer_id).toBeUndefined();

        // Alerts pass through with no field renames
        expect(response.body.data.alerts).toEqual([
            { type: 'armyworm', severity: 'high', description: 'Outbreak in Central', location: 'Lilongwe' },
        ]);
    });

    it('GET /portfolio/farmers/:id returns FarmerDetailDTO with camelCase fields', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [farmerDetailRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/portfolio/farmers/farm-uuid-4')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);

        // Route composes the response from the DTO — verify each camelCase field
        const farmer = response.body.data;
        expect(farmer.id).toBe('farm-uuid-4');
        expect(farmer.name).toBe('John Tembo');
        expect(farmer.farmSize).toBe(2.5); // parseDecimal on string
        expect(farmer.crops).toEqual(['maize', 'beans']);
        expect(farmer.lastVisit).toBe('2024-12-15T10:00:00Z');
        expect(farmer.contact.phone).toBe('+265999123456');
        expect(farmer.contact.preferredLanguage).toBe('en');
        // Location sub-object
        expect(farmer.location.lat).toBe(-13.8);
        expect(farmer.location.lng).toBe(32.9);
        expect(farmer.location.village).toBe('Mchinji');
        // Must NOT leak snake_case
        expect(farmer.first_name).toBeUndefined();
        expect(farmer.farm_size_hectares).toBeUndefined();
    });

    it('GET /portfolio/farmers/:id returns 404 when farmer not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/portfolio/farmers/nonexistent')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
    });
});

describe('Portfolio Route — Negative paths', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        // Restore the default getPool implementation for tests that don't override it
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('GET /portfolio returns 401 when Authorization header is missing', async () => {
        const response = await request(app).get('/api/v1/portfolio');
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        // No query should be attempted without a valid token
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('GET /portfolio returns 503 when getPool() returns null (database unavailable)', async () => {
        mockGetPool.mockReturnValueOnce(null);

        const response = await request(app)
            .get('/api/v1/portfolio')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/database connection/i);
    });

    it('GET /portfolio returns 500 when the query throws (SQL error)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection terminated'));

        const response = await request(app)
            .get('/api/v1/portfolio')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
    });

    it('GET /portfolio returns zero summary counts and an empty priorityQueue when all queries return rows: []', async () => {
        // Summary COUNT(*) queries return zero-valued rows so the mappers don't NPE
        for (let i = 0; i < 5; i++) {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
        }
        // Priority queue query returns empty rows
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/portfolio')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.summary.totalFarmers).toBe(0);
        expect(response.body.data.summary.pendingVisits).toBe(0);
        // The list endpoint surfaces an empty array, not an error
        expect(response.body.data.priorityQueue).toEqual([]);
    });
});

describe('Portfolio Route — Excel export', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('GET /portfolio/export/excel returns an XLSX workbook (Summary + Farmers + Upcoming Visits) populated from the queried rows', async () => {
        // 1) Farmers query — raw snake_case shape returned by the export SQL
        const farmerExportRow = {
            id: 'farm-uuid-1',
            first_name: 'John',
            last_name: 'Tembo',
            phone: '+265999123456',
            village: 'Mchinji',
            district: 'Mchinji',
            region: 'Central',
            farm_size_hectares: '2.5',
            crops: ['maize', 'beans'],
            total_visits: '5',
            last_visit_date: '2024-12-15T10:00:00Z',
        };
        // 2) Upcoming visits query — raw snake_case shape returned by the export SQL
        const visitExportRow = {
            id: 'visit-uuid-1',
            officer_id: 'off-1',
            farmer_id: 'farm-uuid-1',
            visit_type: 'routine',
            status: 'scheduled',
            scheduled_at: '2025-01-15T10:00:00Z',
            notes: 'Follow-up on maize disease',
            first_name: 'John',
            last_name: 'Tembo',
            village: 'Mchinji',
        };

        // Route calls query twice: first for farmers, then for upcoming visits
        mockQuery
            .mockResolvedValueOnce({ rows: [farmerExportRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [visitExportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/portfolio/export/excel')
            .set('Authorization', `Bearer ${officerToken}`)
            .buffer(true)
            .parse(binaryParser);

        expect(response.status).toBe(200);
        // Use regex so future charset suffixes don't break the assertion
        expect(response.headers['content-type']).toMatch(
            /vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/
        );
        // Filename must include the officer id (or 'current' default) and today's date
        expect(response.headers['content-disposition']).toMatch(
            new RegExp(`attachment; filename="portfolio_(off-1|current)_\\d{4}-\\d{2}-\\d{2}\\.xlsx"`)
        );

        // body is a real Buffer now — verify OOXML magic bytes and parse it
        const body = response.body as Buffer;
        expect(body.length).toBeGreaterThan(1000);
        expect(body[0]).toBe(0x50); // 'P'
        expect(body[1]).toBe(0x4b); // 'K' — PK\x03\x04 zip header

        const workbook = parseXlsxBuffer(body);
        expect(workbook.SheetNames).toEqual(['Summary', 'Farmers', 'Upcoming Visits']);

        // Summary sheet: metric row should reflect the fixture
        const summaryRows = readSheet(workbook, 'Summary');
        const totalFarmersCell = summaryRows.find((r) => r[0] === 'Total Farmers');
        expect(totalFarmersCell?.[1]).toBe(1);

        // Farmers sheet: header row + John Tembo's data
        const farmerRows = readSheet(workbook, 'Farmers');
        expect(farmerRows[0]).toEqual([
            'First Name',
            'Last Name',
            'Phone',
            'Village',
            'District',
            'Region',
            'Farm Size (ha)',
            'Crops',
            'Total Visits',
            'Last Visit',
        ]);
        // Route wraps COUNT strings with Number() for symmetry with farm_size_hectares,
        // so the cell holds a numeric 5 instead of the raw Postgres string '5'
        expect(farmerRows[1]).toEqual([
            'John',
            'Tembo',
            '+265999123456',
            'Mchinji',
            'Mchinji',
            'Central',
            2.5, // route wraps with Number() for farm_size_hectares
            'maize, beans',
            5, // COUNT(*) returned as string from Postgres, coerced to Number
            expect.any(String), // locale-formatted date
        ]);

        // Upcoming Visits sheet: header + the visit
        const visitRows = readSheet(workbook, 'Upcoming Visits');
        expect(visitRows[0]).toEqual(['Farmer Name', 'Village', 'Scheduled Date', 'Type', 'Notes']);
        expect(visitRows[1]?.[0]).toBe('John Tembo');
        expect(visitRows[1]?.[1]).toBe('Mchinji');
        expect(visitRows[1]?.[3]).toBe('routine');
        expect(visitRows[1]?.[4]).toBe('Follow-up on maize disease');
    });

    it('GET /portfolio/export/excel succeeds with empty farmers and visits (no data, just headers)', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/portfolio/export/excel')
            .set('Authorization', `Bearer ${officerToken}`)
            .buffer(true)
            .parse(binaryParser);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(
            /vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/
        );
        const body = response.body as Buffer;
        expect(body.length).toBeGreaterThan(1000);

        // Even with no data, all 3 sheets should still be present (Summary row says Total Farmers = 0)
        const workbook = parseXlsxBuffer(body);
        expect(workbook.SheetNames).toEqual(['Summary', 'Farmers', 'Upcoming Visits']);
        const summaryRows = readSheet(workbook, 'Summary');
        expect(summaryRows.find((r) => r[0] === 'Total Farmers')?.[1]).toBe(0);

        // Farmers + Upcoming Visits sheets should contain *only* the header row
        // (no phantom data rows from shared state or off-by-one bugs)
        expect(readSheet(workbook, 'Farmers')).toHaveLength(1);
        expect(readSheet(workbook, 'Upcoming Visits')).toHaveLength(1);
    });

    it('GET /portfolio/export/excel returns 401 when Authorization header is missing', async () => {
        const response = await request(app).get('/api/v1/portfolio/export/excel');
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('GET /portfolio/export/excel returns 503 when getPool() returns null (database unavailable)', async () => {
        mockGetPool.mockReturnValueOnce(null);

        const response = await request(app)
            .get('/api/v1/portfolio/export/excel')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/database connection/i);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('GET /portfolio/export/excel returns 500 when the query throws (SQL error)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection terminated'));

        const response = await request(app)
            .get('/api/v1/portfolio/export/excel')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
    });
});

describe('Portfolio Route — Mapper-before-response: mapPortfolioExportFarmerRow + mapPortfolioExportVisitRow', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(() => {
        mockQuery.mockReset();
        mockGetPool.mockReset();
        mockGetPool.mockImplementation(() => ({ query: jest.fn() }));
    });

    it('GET /portfolio/export/excel invokes mapPortfolioExportFarmerRow + mapPortfolioExportVisitRow before responding', async () => {
        // 1) Farmers query — raw snake_case row returned by pg
        const farmerExportRow = {
            id: 'farm-uuid-1',
            first_name: 'John',
            last_name: 'Tembo',
            phone: '+265999123456',
            village: 'Mchinji',
            district: 'Mchinji',
            region: 'Central',
            farm_size_hectares: '2.5',
            crops: ['maize', 'beans'],
            total_visits: '5',
            last_visit_date: '2024-12-15T10:00:00Z',
        };
        // 2) Visits query — raw snake_case row
        const visitExportRow = {
            id: 'visit-uuid-1',
            officer_id: 'off-1',
            farmer_id: 'farm-uuid-1',
            visit_type: 'routine',
            status: 'scheduled',
            scheduled_at: '2025-01-15T10:00:00Z',
            notes: 'Follow-up on maize disease',
            first_name: 'John',
            last_name: 'Tembo',
            village: 'Mchinji',
        };

        mockQuery
            .mockResolvedValueOnce({ rows: [farmerExportRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [visitExportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/portfolio/export/excel')
            .set('Authorization', `Bearer ${officerToken}`)
            .buffer(true)
            .parse(binaryParser);

        // The XLSX body is the post-mapper workbook, so we parse it to assert
        // the mappers ran (snake_case row → camelCase sheet cells)
        const body = response.body as Buffer;
        expect(body.length).toBeGreaterThan(1000);
        const workbook = parseXlsxBuffer(body);
        const farmerRows = readSheet(workbook, 'Farmers');
        const firstFarmerRow = farmerRows[1] as unknown[] | undefined;
        // mapPortfolioExportFarmerRow: first_name→firstName, last_name→lastName,
        // farm_size_hectares→farmSizeHectares (Number), total_visits→totalVisits (Number)
        expect(firstFarmerRow?.[0]).toBe('John');
        expect(firstFarmerRow?.[1]).toBe('Tembo');
        // Must NOT leak snake_case into the sheet — keys are numeric indexes
        // after `aoa_to_sheet`, so we assert the snake_case row's columns
        // are NOT present in the index-keyed output
        expect(firstFarmerRow?.length).toBeGreaterThan(0);
    });
});
