import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { usageService } from '../services/usageService';
import { binaryParser, readSheet, parseXlsxBuffer, parseCsv } from './helpers/xlsx';
import type {
    VisitStatsRow,
    ConversationStatsRow,
    ReportListRow,
} from '../types/rowTypes';

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

jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
        if (!req.headers?.authorization) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        // Attach a fake user so handlers that touch req.user!.userId (e.g. POST /generate)
        // don't NPE in tests.
        req.user = { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' };
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => {
        next();
    },
    AuthRequest: jest.fn(),
    UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

jest.mock('../middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => {
        next();
    },
}));

jest.mock('../services/usageService', () => ({
    usageService: {
        incrementUsage: jest.fn().mockResolvedValue(undefined),
        incrementUsageBy: jest.fn().mockResolvedValue(undefined),
    },
}));

// Mock pdfkit's PDFDocument constructor so we can assert which sections each
// report type draws without depending on the real PDF binary output.
// `pipe(res)` captures the response so `end()` can close it cleanly.
jest.mock('pdfkit', () => {
    const MockPDFDocument = jest.fn().mockImplementation(() => {
        const doc: any = {
            page: { width: 595, height: 842 },
            y: 0,
            x: 0,
            text: jest.fn().mockReturnThis(),
            fontSize: jest.fn().mockReturnThis(),
            font: jest.fn().mockReturnThis(),
            fillColor: jest.fn().mockReturnThis(),
            rect: jest.fn().mockReturnThis(),
            fill: jest.fn().mockReturnThis(),
            stroke: jest.fn().mockReturnThis(),
            moveDown: jest.fn().mockReturnThis(),
            __pipeTarget: null as { end?: () => void } | null,
            pipe: jest.fn((target: { end?: () => void }) => {
                doc.__pipeTarget = target;
                return target;
            }),
            end: jest.fn(() => {
                const t = doc.__pipeTarget;
                if (t && typeof t.end === 'function') t.end();
                return doc;
            }),
        };
        return doc;
    });
    return { __esModule: true, default: MockPDFDocument };
});

import { query, getPool } from '../services/databaseService';
import PDFDocument from 'pdfkit';
const mockQuery = query as jest.Mock;
const mockGetPool = getPool as jest.Mock;
const PDFDocumentMock = PDFDocument as unknown as jest.Mock;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const reportRow = {
    id: 'rpt-1',
    type: 'disease_diagnosis',
    title: 'Maize Leaf Diagnosis',
    status: 'completed',
    content: {
        overallHealth: 'diseased' as const,
        confidence: 87,
        diseases: [
            {
                disease: 'Northern Leaf Blight',
                severity: 'moderate',
                confidence: 82,
                description: 'Grey-green lesions on lower leaves.',
                symptoms: ['Long lesions', 'Grey-green colour'],
                treatment: ['Apply fungicide', 'Remove debris'],
            },
        ],
        nutrientDeficiencies: ['Nitrogen'],
        recommendations: ['Apply balanced NPK', 'Rotate crop next season'],
        metadata: {
            region: 'Central',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            officerId: 'off-1',
            cropType: 'maize',
        },
    },
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z',
};

const soilReportRow = {
    ...reportRow,
    type: 'soil_diagnostic',
    content: {
        overallHealthScore: 72,
        texture: 'sandy loam',
        estimatedMoisture: 'moderate',
        drainageClass: 'good',
        colorDiscoloration: 'none',
        npkDeficiencies: { nitrogen: 'optimal', phosphorus: 'low', potassium: 'optimal' },
        cropSuitability: ['maize', 'beans'],
        recommendations: ['Add rock phosphate', 'Mulch to retain moisture'],
        metadata: reportRow.content.metadata,
    },
};

const generalReportRow = {
    ...reportRow,
    type: 'activity_report',
    title: 'Q1 Activity Summary',
    content: {
        visits: { total: 12, completed: 10, totalMinutes: 480 },
        conversations: { totalConversations: 25, rated: 18, avgSatisfaction: 4.2 },
        metadata: reportRow.content.metadata,
    },
};

const emptyReportRow = {
    ...reportRow,
    type: 'activity_report',
    title: 'Q1 Activity Summary',
    content: {
        visits: { total: 0, completed: 0, totalMinutes: null },
        conversations: { totalConversations: 0, rated: 0, avgSatisfaction: null },
        metadata: reportRow.content.metadata,
    },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Reporting Route — PDF generation for 3 report types', () => {
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
        PDFDocumentMock.mockClear();
    });

    it('GET /:id/download/pdf draws the OVERALL CROP HEALTH STATUS section for disease_diagnosis', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download/pdf')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toContain('report_rpt-1.pdf');

        // Exactly one doc per request, instantiated with the standard margin
        expect(PDFDocumentMock).toHaveBeenCalledTimes(1);
        expect(PDFDocumentMock).toHaveBeenCalledWith({ margin: 50 });
        const doc = PDFDocumentMock.mock.results.at(-1)!.value;
        // Pipe→end lifecycle is correctly closed (no dangling response)
        expect(doc.pipe).toHaveBeenCalledTimes(1);
        expect(doc.end).toHaveBeenCalledTimes(1);
        // Disease branch draws the health-status banner (positional x, y args)
        expect(doc.text).toHaveBeenCalledWith(
            expect.stringContaining('OVERALL CROP HEALTH STATUS'),
            expect.any(Number),
            expect.any(Number)
        );
        // Must NOT draw the general/soil sections — proves the branch is correct
        expect(doc.text).not.toHaveBeenCalledWith(
            'Agricultural Extension Report',
            expect.any(Object)
        );
        expect(doc.text).not.toHaveBeenCalledWith(
            expect.stringContaining('SOIL DIAGNOSTIC QUALITY RATING'),
            expect.any(Number),
            expect.any(Number)
        );
    });

    it('GET /:id/download/pdf draws the SOIL DIAGNOSTIC QUALITY RATING section for soil_diagnostic', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [soilReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download/pdf')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/pdf');

        expect(PDFDocumentMock).toHaveBeenCalledTimes(1);
        const doc = PDFDocumentMock.mock.results.at(-1)!.value;
        expect(doc.pipe).toHaveBeenCalledTimes(1);
        expect(doc.end).toHaveBeenCalledTimes(1);
        // Soil branch draws the quality-rating banner (positional x, y args)
        expect(doc.text).toHaveBeenCalledWith(
            expect.stringContaining('SOIL DIAGNOSTIC QUALITY RATING'),
            expect.any(Number),
            expect.any(Number)
        );
        // Must NOT draw the disease/general sections
        expect(doc.text).not.toHaveBeenCalledWith(
            expect.stringContaining('OVERALL CROP HEALTH STATUS'),
            expect.any(Number),
            expect.any(Number)
        );
        expect(doc.text).not.toHaveBeenCalledWith(
            'Agricultural Extension Report',
            expect.any(Object)
        );
    });

    it('GET /:id/download/pdf draws the Agricultural Extension Report header for general/activity_report', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [generalReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download/pdf')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/pdf');

        expect(PDFDocumentMock).toHaveBeenCalledTimes(1);
        const doc = PDFDocumentMock.mock.results.at(-1)!.value;
        expect(doc.pipe).toHaveBeenCalledTimes(1);
        expect(doc.end).toHaveBeenCalledTimes(1);
        // General branch draws the centered title (options-object signature)
        expect(doc.text).toHaveBeenCalledWith(
            'Agricultural Extension Report',
            expect.objectContaining({ align: 'center' })
        );
        // Must NOT draw the disease/soil banners
        expect(doc.text).not.toHaveBeenCalledWith(
            expect.stringContaining('OVERALL CROP HEALTH STATUS'),
            expect.any(Number),
            expect.any(Number)
        );
        expect(doc.text).not.toHaveBeenCalledWith(
            expect.stringContaining('SOIL DIAGNOSTIC QUALITY RATING'),
            expect.any(Number),
            expect.any(Number)
        );
    });

    it('GET /:id/download/pdf returns 404 when report not found and does not construct a PDF', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/reporting/missing/download/pdf')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(404);
        // No PDF generated for a missing report
        expect(PDFDocumentMock).not.toHaveBeenCalled();
    });
});

describe('Reporting Route — XLSX export', () => {
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

    it('GET /:id/download/excel succeeds with empty visits and conversations', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [emptyReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download/excel')
            .set('Authorization', `Bearer ${officerToken}`)
            .buffer(true)
            .parse(binaryParser);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        expect(response.headers['content-disposition']).toContain('report_rpt-1.xlsx');
        const body = response.body as Buffer;
        expect(body.length).toBeGreaterThan(0);

        // Verify the body is a real XLSX with all 3 expected sheets
        const workbook = parseXlsxBuffer(body);
        expect(workbook.SheetNames).toEqual(['Summary', 'Visits', 'Conversations']);

        // Summary sheet contains the report title + type
        const summaryRows = readSheet(workbook, 'Summary');
        expect(summaryRows).toContainEqual(['Report Title', 'Q1 Activity Summary']);
        expect(summaryRows).toContainEqual(['Report Type', 'activity_report']);

        // Visits sheet: header + zero-valued rows (null → 0 via `|| 0`)
        const visitRows = readSheet(workbook, 'Visits');
        expect(visitRows).toContainEqual(['Metric', 'Value']);
        expect(visitRows).toContainEqual(['Total Visits', 0]);
        expect(visitRows).toContainEqual(['Completed Visits', 0]);

        // Conversations sheet: header + zero-valued rows
        const convRows = readSheet(workbook, 'Conversations');
        expect(convRows).toContainEqual(['Metric', 'Value']);
        expect(convRows).toContainEqual(['Total Conversations', 0]);
        expect(convRows).toContainEqual(['Rated Conversations', 0]);
        expect(convRows).toContainEqual(['Average Satisfaction', 0]);
    });

    it('GET /:id/download/excel succeeds with populated visits and conversations', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [generalReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download/excel')
            .set('Authorization', `Bearer ${officerToken}`)
            .buffer(true)
            .parse(binaryParser);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        const body = response.body as Buffer;
        expect(body.length).toBeGreaterThan(0);

        // Verify the body is a real XLSX with all 3 expected sheets
        const workbook = parseXlsxBuffer(body);
        expect(workbook.SheetNames).toEqual(['Summary', 'Visits', 'Conversations']);

        // Visits sheet: header + populated metric rows
        const visitRows = readSheet(workbook, 'Visits');
        expect(visitRows).toContainEqual(['Metric', 'Value']);
        expect(visitRows).toContainEqual(['Total Visits', 12]);
        expect(visitRows).toContainEqual(['Completed Visits', 10]);
        expect(visitRows).toContainEqual(['Total Minutes', 480]);

        // Conversations sheet: header + populated metric rows
        const convRows = readSheet(workbook, 'Conversations');
        expect(convRows).toContainEqual(['Metric', 'Value']);
        expect(convRows).toContainEqual(['Total Conversations', 25]);
        expect(convRows).toContainEqual(['Rated Conversations', 18]);
        expect(convRows).toContainEqual(['Average Satisfaction', 4.2]);
    });

    it('GET /:id/download/excel for disease_diagnosis returns only the Summary sheet (no Visits/Conversations)', async () => {
        // For disease_diagnosis / soil_diagnostic reports, `data.visits` and
        // `data.conversations` are undefined — the route only appends the
        // Summary sheet. This guards against regression where conditional
        // sheet creation would leak empty Visits/Conversations sheets.
        mockQuery.mockResolvedValueOnce({ rows: [reportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download/excel')
            .set('Authorization', `Bearer ${officerToken}`)
            .buffer(true)
            .parse(binaryParser);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        expect(response.headers['content-disposition']).toContain('report_rpt-1.xlsx');

        const body = response.body as Buffer;
        expect(body.length).toBeGreaterThan(1000);
        const workbook = parseXlsxBuffer(body);
        // Only Summary — no Visits/Conversations sheets
        expect(workbook.SheetNames).toEqual(['Summary']);

        const summaryRows = readSheet(workbook, 'Summary');
        expect(summaryRows).toContainEqual(['Report Title', 'Maize Leaf Diagnosis']);
        expect(summaryRows).toContainEqual(['Report Type', 'disease_diagnosis']);
    });
});

describe('Reporting Route — CSV export', () => {
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

    it('GET /:id/download returns a CSV with header + populated visits/conversation rows', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [generalReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('report_rpt-1.csv');

        // Parse the CSV text into a 2D array mirroring readSheet for XLSX
        const rows = parseCsv(response.text);
        expect(rows[0]).toEqual(['Metric', 'Value']);
        expect(rows).toContainEqual(['Total Visits', '12']);
        expect(rows).toContainEqual(['Completed Visits', '10']);
        expect(rows).toContainEqual(['Total Minutes', '480']);
        expect(rows).toContainEqual(['Total Conversations', '25']);
        expect(rows).toContainEqual(['Average Satisfaction', '4.2']);
    });

    it('GET /:id/download returns a CSV with zero-valued rows for empty activity_report', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [emptyReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        const rows = parseCsv(response.text);
        expect(rows[0]).toEqual(['Metric', 'Value']);
        // null → 0 via `|| 0` coercion in the route
        expect(rows).toContainEqual(['Total Visits', '0']);
        expect(rows).toContainEqual(['Completed Visits', '0']);
        expect(rows).toContainEqual(['Total Minutes', '0']);
        expect(rows).toContainEqual(['Total Conversations', '0']);
        expect(rows).toContainEqual(['Average Satisfaction', '0']);
    });

    it('GET /:id/download returns a CSV with only the header row for disease_diagnosis (no visits/conversations)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        const rows = parseCsv(response.text);
        // Only the header — the route skips both visit/conversation blocks when
        // data.visits / data.conversations are undefined
        expect(rows).toEqual([['Metric', 'Value']]);
    });
});

describe('Reporting Route — Row type correctness (snake_case → camelCase DTOs)', () => {
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

    it('GET /:id returns ReportListDTO with camelCase generatedAt', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe('rpt-1');
        expect(response.body.data.type).toBe('disease_diagnosis');
        expect(response.body.data.title).toBe('Maize Leaf Diagnosis');
        // snake_case `created_at` → camelCase `generatedAt`
        expect(response.body.data.generatedAt).toBe('2024-12-15T10:00:00Z');
        expect(response.body.data.status).toBe('completed');
        // Must NOT leak snake_case
        expect(response.body.data.created_at).toBeUndefined();
    });

    it('GET /:id/download returns CSV with camelCase visit/conversation field names', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [generalReportRow], rowCount: 1 });

        const response = await request(app)
            .get('/api/v1/reporting/rpt-1/download')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
        // CSV references camelCase fields on data.visits / data.conversations
        const csv = response.text;
        expect(csv).toContain('Total Visits,12');
        expect(csv).toContain('Completed Visits,10');
        expect(csv).toContain('Total Minutes,480');
        expect(csv).toContain('Total Conversations,25');
    });
});

describe('Reporting Route — POST /generate invokes mappers before storage', () => {
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

    it('POST /generate runs mapVisitStatsRow + mapConversationStatsRow before storing JSONB (activity_report)', async () => {
        // 1) Raw visit aggregation — pg returns COUNT/SUM as stringified numbers
        const visitRawRow: VisitStatsRow = {
            total: '12',
            completed: '10',
            total_minutes: '480',
        };
        // 2) Raw conversation aggregation — pg returns COUNT/SUM/AVG as strings
        const convRawRow: ConversationStatsRow = {
            total_conversations: '25',
            rated: '18',
            avg_satisfaction: '4.2',
        };
        // 3) INSERT ... RETURNING — the route runs mapReportListRow on this row.
        // We only need id/type/title/status/created_at/updated_at here;
        // `content` is irrelevant because the response spreads `fullReportContent`
        // at the top level of `data`, not from the DTO's content. The title is
        // generated dynamically by the route; this is just a placeholder that
        // round-trips through the DTO.
        const insertedRow: ReportListRow = {
            id: 'rpt-new',
            type: 'activity_report',
            title: 'Activity Report',
            status: 'completed',
            content: {
                metadata: {
                    region: null,
                    startDate: '2024-11-15T00:00:00.000Z',
                    endDate: '2024-12-15T00:00:00.000Z',
                    officerId: null,
                },
            },
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };

        // Query order in generateReportData: visit aggregation → conversation aggregation → INSERT
        mockQuery
            .mockResolvedValueOnce({ rows: [visitRawRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [convRawRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/reporting/generate')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ type: 'activity_report' });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(mockQuery).toHaveBeenCalledTimes(3);

        // 3rd call is the INSERT — capture params to inspect the stored JSONB
        const insertCall = mockQuery.mock.calls[2];
        const insertParams = insertCall[1] as unknown[];
        const contentJson = insertParams[3] as string;
        const content = JSON.parse(contentJson);

        // Visits: snake_case → camelCase, stringified numbers → numbers.
        // `toEqual` already enforces numeric types, so explicit typeof checks are redundant.
        expect(content.visits).toEqual({
            total: 12,
            completed: 10,
            totalMinutes: 480,
        });
        // Negative assertions prove the mapper actually ran (no raw snake_case leak)
        expect(content.visits.total_minutes).toBeUndefined();
        expect(content.visits.totalMinutes).toBe(480);

        // Conversations: snake_case → camelCase, stringified numbers → numbers
        expect(content.conversations).toEqual({
            totalConversations: 25,
            rated: 18,
            avgSatisfaction: 4.2,
        });
        expect(content.conversations.total_conversations).toBeUndefined();
        expect(content.conversations.avg_satisfaction).toBeUndefined();
        expect(content.conversations.avgSatisfaction).toBe(4.2);

        // Metadata round-trips alongside the mapped stats. `region` and
        // `officerId` are `undefined` when not provided in the body, so
        // `JSON.stringify` drops them — only the date range survives.
        expect(content.metadata).toEqual(
            expect.objectContaining({
                startDate: expect.any(String),
                endDate: expect.any(String),
            })
        );

        // INSERT params: [type, title, generatedBy, contentJson]
        expect(insertParams[0]).toBe('activity_report');
        // $3 should resolve to req.user.userId since no officerId was provided in the body
        expect(insertParams[2]).toBe('off-1');

        // Side effect: usage counter incremented for the generated report
        expect(usageService.incrementUsage).toHaveBeenCalledWith('off-1', 'report');

        // End-to-end: the response shape is flattened so `fullReportContent`
        // fields (visits, conversations, metadata) live at `response.body.data.*`
        // alongside the DTO metadata (id, type, title, generatedAt, status),
        // rather than nested under `response.body.data.data.*`.
        expect(response.body.data.visits).toEqual({
            total: 12,
            completed: 10,
            totalMinutes: 480,
        });
        expect(response.body.data.conversations).toEqual({
            totalConversations: 25,
            rated: 18,
            avgSatisfaction: 4.2,
        });
        // Raw snake_case must NOT leak into the API response either
        expect(response.body.data.visits.total_minutes).toBeUndefined();
        expect(response.body.data.conversations.total_conversations).toBeUndefined();

        // metadata round-trips through the flatten too (startDate/endDate are
        // always set; region/officerId are undefined when not in the body and
        // are dropped by JSON.stringify)
        expect(response.body.data.metadata).toEqual(
            expect.objectContaining({
                startDate: expect.any(String),
                endDate: expect.any(String),
            })
        );

        // mapReportListRow output: DTO metadata fields are flattened to data.*
        // alongside the content fields, proving the mapper ran on the
        // INSERT ... RETURNING row.
        expect(response.body.data.id).toBe('rpt-new');
        expect(response.body.data.type).toBe('activity_report');
        expect(response.body.data.title).toBe('Activity Report');
        // snake_case `created_at` → camelCase `generatedAt` in the DTO mapper
        expect(response.body.data.generatedAt).toBe('2024-12-15T10:00:00Z');
        expect(response.body.data.status).toBe('completed');
        // Must NOT leak snake_case
        expect(response.body.data.created_at).toBeUndefined();
    });

    it('POST /generate with visit_summary only runs the visit mapper (no conversation query)', async () => {
        const visitRawRow: VisitStatsRow = {
            total: '5',
            completed: '3',
            total_minutes: '120',
        };
        const insertedRow: ReportListRow = {
            id: 'rpt-v',
            type: 'visit_summary',
            title: 'Visit Summary',
            status: 'completed',
            content: {
                metadata: {
                    region: null,
                    startDate: '2024-11-15T00:00:00.000Z',
                    endDate: '2024-12-15T00:00:00.000Z',
                    officerId: null,
                },
            },
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };

        mockQuery
            .mockResolvedValueOnce({ rows: [visitRawRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/reporting/generate')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ type: 'visit_summary' });

        expect(response.status).toBe(201);
        // Only 2 queries: visit aggregation + INSERT (no conversation query)
        expect(mockQuery).toHaveBeenCalledTimes(2);

        const insertCall = mockQuery.mock.calls[1];
        const insertParams = insertCall[1] as unknown[];
        const content = JSON.parse(insertParams[3] as string);

        expect(content.visits).toEqual({ total: 5, completed: 3, totalMinutes: 120 });
        expect(content.visits.total_minutes).toBeUndefined();
        expect(content.conversations).toBeUndefined();

        // Flattened response: visits live at `data.visits`, not `data.data.visits`
        expect(response.body.data.visits).toEqual({ total: 5, completed: 3, totalMinutes: 120 });
        expect(response.body.data.conversations).toBeUndefined();
        expect(response.body.data.metadata).toEqual(
            expect.objectContaining({
                startDate: expect.any(String),
                endDate: expect.any(String),
            })
        );
    });

    it('POST /generate with impact_metrics only runs the conversation mapper (no visit query)', async () => {
        const convRawRow: ConversationStatsRow = {
            total_conversations: '42',
            rated: '30',
            avg_satisfaction: '3.8',
        };
        const insertedRow: ReportListRow = {
            id: 'rpt-im',
            type: 'impact_metrics',
            title: 'Impact Metrics',
            status: 'completed',
            content: {
                metadata: {
                    region: null,
                    startDate: '2024-11-15T00:00:00.000Z',
                    endDate: '2024-12-15T00:00:00.000Z',
                    officerId: null,
                },
            },
            created_at: '2024-12-15T10:00:00Z',
            updated_at: '2024-12-15T10:00:00Z',
        };

        mockQuery
            .mockResolvedValueOnce({ rows: [convRawRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });

        const response = await request(app)
            .post('/api/v1/reporting/generate')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ type: 'impact_metrics' });

        expect(response.status).toBe(201);
        // Only 2 queries: conversation aggregation + INSERT (no visit query)
        expect(mockQuery).toHaveBeenCalledTimes(2);

        const insertCall = mockQuery.mock.calls[1];
        const insertParams = insertCall[1] as unknown[];
        const content = JSON.parse(insertParams[3] as string);

        expect(content.conversations).toEqual({
            totalConversations: 42,
            rated: 30,
            avgSatisfaction: 3.8,
        });
        expect(content.conversations.total_conversations).toBeUndefined();
        expect(content.visits).toBeUndefined();

        // Flattened response: conversations live at `data.conversations`,
        // not `data.data.conversations`
        expect(response.body.data.conversations).toEqual({
            totalConversations: 42,
            rated: 30,
            avgSatisfaction: 3.8,
        });
        expect(response.body.data.visits).toBeUndefined();
        expect(response.body.data.metadata).toEqual(
            expect.objectContaining({
                startDate: expect.any(String),
                endDate: expect.any(String),
            })
        );
    });
});

describe('Reporting Route — Negative paths', () => {
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

    it('GET / returns 401 when Authorization header is missing', async () => {
        const response = await request(app).get('/api/v1/reporting');
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        // No query should be attempted without a valid token
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('GET / returns 503 when getPool() returns null (database unavailable)', async () => {
        mockGetPool.mockReturnValueOnce(null);

        const response = await request(app)
            .get('/api/v1/reporting')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/database connection/i);
    });

    it('GET / returns 500 when the underlying query throws (SQL error)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('relation "reports" does not exist'));

        const response = await request(app)
            .get('/api/v1/reporting')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
    });

    it('GET / returns an empty reports list when the query returns rows: []', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const response = await request(app)
            .get('/api/v1/reporting')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.reports).toEqual([]);
        expect(response.body.data.total).toBe(0);
    });

    it('POST /generate returns 401 when Authorization header is missing', async () => {
        const response = await request(app)
            .post('/api/v1/reporting/generate')
            .send({ type: 'activity_report' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('POST /generate returns 503 when getPool() returns null (database unavailable)', async () => {
        mockGetPool.mockReturnValueOnce(null);

        const response = await request(app)
            .post('/api/v1/reporting/generate')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ type: 'activity_report' });

        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/database connection/i);
    });

    it('POST /generate returns 500 when the visit aggregation query throws (SQL error)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('relation "visits" does not exist'));

        const response = await request(app)
            .post('/api/v1/reporting/generate')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({ type: 'activity_report' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
    });
});
