import request from 'supertest';
import app from '../app';

/**
 * Officer–farmer journey routes: the progress log, photos on chat messages and
 * the visit report (findings, follow-up, photos). The database is a SQL
 * dispatcher; farmer scope comes from getFarmerForPrincipal, which the real
 * end-to-end suite exercises against Postgres.
 */

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({ query: jest.fn() })),
    query: jest.fn(),
}));

jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: { headers?: { authorization?: string }; user?: unknown }, res: { status: (c: number) => { json: (b: unknown) => void } }, next: () => void) => {
        const token = (req.headers?.authorization || '').replace('Bearer ', '');
        if (!token) {
            res.status(401).json({ success: false, error: 'No token provided' });
            return;
        }
        req.user = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        next();
    },
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../services/usageService', () => ({
    ...jest.requireActual('../services/usageService'),
    usageService: {
        ...jest.requireActual('../services/usageService').usageService,
        isFreeUser: jest.fn().mockResolvedValue(false),
    },
}));

jest.mock('../services/dataGovernanceService', () => ({
    ...jest.requireActual('../services/dataGovernanceService'),
    getFarmerForPrincipal: jest.fn(),
}));

import { query } from '../services/databaseService';
import { getFarmerForPrincipal } from '../services/dataGovernanceService';

const mockQuery = query as jest.Mock;
const mockFarmerAccess = getFarmerForPrincipal as jest.Mock;

const FARMER_ID = '11111111-1111-4111-8111-111111111111';
const VISIT_ID = '22222222-2222-4222-8222-222222222222';
const UPLOAD_ID = '33333333-3333-4333-8333-333333333333';

const header = (user: Record<string, string>) => ({
    Authorization: `Bearer ${Buffer.from(JSON.stringify(user)).toString('base64')}`,
});
const officer = header({ userId: 'off-1', role: 'extension_officer', email: 'o@e.test' });
const farmerUser = header({ userId: 'farmer-user-1', role: 'farmer', email: 'f@e.test' });

const servedFarmer = { id: FARMER_ID, user_id: 'farmer-user-1', assigned_officer_id: 'off-1', region: 'Rift Valley', tenant_id: 'tenant-1', is_active: true, is_demo: false };

type Responder = (sql: string, params: unknown[]) => { rows: unknown[] } | undefined;

/** Answers each SQL statement from the first responder that recognises it. */
function database(...responders: Responder[]) {
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
        for (const respond of responders) {
            const result = respond(sql, params);
            if (result) return { rowCount: result.rows.length, ...result };
        }
        return { rows: [], rowCount: 0 };
    });
}

const progressRow = {
    id: 'entry-1', farmer_id: FARMER_ID, officer_id: 'off-1', officer_name: 'Daniel Kiptoo', visit_id: null,
    kind: 'failure', title: 'Bean seedlings damped off', details: 'Waterlogged corner of the plot', crop: 'beans',
    occurred_on: '2026-11-18', created_at: '2026-11-18T09:00:00Z',
};

describe('farmer progress log', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockFarmerAccess.mockReset();
    });

    const entry = { kind: 'failure', title: 'Bean seedlings damped off', crop: 'beans', occurredOn: '2026-11-18', details: 'Waterlogged corner of the plot' };

    it('records an entry for a farmer the officer serves', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database(
            sql => (sql.includes('INSERT INTO farmer_progress_entries') ? { rows: [{ id: 'entry-1' }] } : undefined),
            sql => (sql.includes('FROM farmer_progress_entries e') ? { rows: [progressRow] } : undefined),
        );

        const res = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(officer).send(entry);

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ kind: 'failure', title: 'Bean seedlings damped off', occurredOn: '2026-11-18', officerName: 'Daniel Kiptoo', attachments: [] });
        const insert = mockQuery.mock.calls.find(call => String(call[0]).includes('INSERT INTO farmer_progress_entries'));
        expect(insert?.[1]).toEqual([FARMER_ID, 'off-1', 'tenant-1', null, 'failure', 'Bean seedlings damped off', 'Waterlogged corner of the plot', 'beans', '2026-11-18']);
    });

    it('refuses a farmer outside the officer\'s scope', async () => {
        mockFarmerAccess.mockResolvedValue(null);
        const res = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(officer).send(entry);
        expect(res.status).toBe(403);
        expect(mockQuery.mock.calls.some(call => String(call[0]).includes('INSERT INTO farmer_progress_entries'))).toBe(false);
    });

    it('leaves recording to staff: a farmer can read but not write', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database(sql => (sql.includes('FROM farmer_progress_entries e') ? { rows: [progressRow] } : undefined));

        const write = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(farmerUser).send(entry);
        expect(write.status).toBe(403);

        const read = await request(app).get(`/api/v1/farmers/${FARMER_ID}/progress`).set(farmerUser);
        expect(read.status).toBe(200);
        expect(read.body.data).toHaveLength(1);
    });

    it('rejects an unknown kind and a date in the future', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database();
        const kind = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(officer).send({ ...entry, kind: 'rumour' });
        expect(kind.status).toBe(400);
        const future = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(officer).send({ ...entry, occurredOn: '2999-01-01' });
        expect(future.status).toBe(400);
    });

    it('refuses a visit that is not this farmer\'s', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database(sql => (sql.includes('FROM visits WHERE id') ? { rows: [] } : undefined));
        const res = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(officer).send({ ...entry, visitId: VISIT_ID });
        expect(res.status).toBe(400);
    });

    it('refuses photos the officer did not upload for this farmer', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database(sql => (sql.includes('FROM upload_records') ? { rows: [] } : undefined));
        const res = await request(app).post(`/api/v1/farmers/${FARMER_ID}/progress`).set(officer).send({ ...entry, attachmentIds: [UPLOAD_ID] });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Photos must be images you uploaded for this farmer');
    });
});

describe('photos on chat messages', () => {
    beforeEach(() => mockQuery.mockReset());

    const conversationAccess: Responder = sql =>
        (sql.includes('LEFT JOIN farmers') ? { rows: [{ farmer_id: FARMER_ID, officer_id: 'off-1', region: 'Rift Valley' }] } : undefined);

    it('sends a photo-only message with readable text and returns the photo', async () => {
        database(
            conversationAccess,
            sql => (sql.includes('SELECT farmer_id FROM chat_conversations') ? { rows: [{ farmer_id: FARMER_ID }] } : undefined),
            sql => (sql.includes('FROM upload_records') && !sql.includes('JOIN') ? { rows: [{ id: UPLOAD_ID }] } : undefined),
            (sql, params) => (sql.includes('INSERT INTO chat_messages')
                ? { rows: [{ id: 'msg-1', conversation_id: 'conv-1', role: 'officer', content: params[2], created_at: '2026-11-19T08:00:00Z' }] }
                : undefined),
            sql => (sql.includes('FROM chat_message_attachments')
                ? { rows: [{ parent_id: 'msg-1', id: UPLOAD_ID, storage_key: 'leaf.png', original_name: 'leaf.png', mime_type: 'image/png' }] }
                : undefined),
        );

        const res = await request(app).post('/api/v1/chatbot/messages').set(officer)
            .send({ conversationId: 'conv-1', content: '', attachmentIds: [UPLOAD_ID] });

        expect(res.status).toBe(201);
        expect(res.body.data.content).toBe('Shared a photo');
        expect(res.body.data.attachments).toEqual([{ id: UPLOAD_ID, url: '/api/v1/upload/file/leaf.png', name: 'leaf.png', mimeType: 'image/png' }]);
        expect(mockQuery.mock.calls.some(call => String(call[0]).includes('INSERT INTO chat_message_attachments'))).toBe(true);
    });

    it('refuses a photo that was not uploaded for the thread\'s farmer', async () => {
        database(
            conversationAccess,
            sql => (sql.includes('SELECT farmer_id FROM chat_conversations') ? { rows: [{ farmer_id: FARMER_ID }] } : undefined),
            sql => (sql.includes('FROM upload_records') ? { rows: [] } : undefined),
        );

        const res = await request(app).post('/api/v1/chatbot/messages').set(officer)
            .send({ conversationId: 'conv-1', content: 'See this', attachmentIds: [UPLOAD_ID] });

        expect(res.status).toBe(400);
        expect(mockQuery.mock.calls.some(call => String(call[0]).includes('INSERT INTO chat_messages'))).toBe(false);
    });

    it('caps the number of photos per message', async () => {
        database(conversationAccess);
        const ids = Array.from({ length: 5 }, (_, i) => `4444444${i}-4444-4444-8444-444444444444`);
        const res = await request(app).post('/api/v1/chatbot/messages').set(officer)
            .send({ conversationId: 'conv-1', content: 'Five photos', attachmentIds: ids });
        expect(res.status).toBe(400);
    });
});

describe('visit report', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockFarmerAccess.mockReset();
    });

    it('records findings, the follow-up and photos when completing a visit', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database(
            sql => (sql.includes('SELECT farmer_id, duration_minutes') ? { rows: [{ farmer_id: FARMER_ID }] } : undefined),
            sql => (sql.includes('FROM upload_records') ? { rows: [{ id: UPLOAD_ID }] } : undefined),
        );

        const res = await request(app).patch(`/api/v1/visits/${VISIT_ID}`).set(officer).send({
            status: 'completed',
            durationMinutes: 45,
            outcomes: 'Nitrogen deficiency on the lower leaves',
            notes: 'Top-dressed with CAN',
            followUpRequired: true,
            followUpDate: '2026-12-04',
            attachmentIds: [UPLOAD_ID],
        });

        expect(res.status).toBe(200);
        const update = mockQuery.mock.calls.find(call => String(call[0]).startsWith('UPDATE visits SET'));
        expect(String(update?.[0])).toContain('follow_up_required');
        expect(update?.[1]).toEqual(expect.arrayContaining([true, '2026-12-04', 45]));
        const link = mockQuery.mock.calls.find(call => String(call[0]).includes('INSERT INTO visit_attachments'));
        expect(link?.[1]).toEqual([VISIT_ID, [UPLOAD_ID]]);
    });

    it('refuses photos that are not the officer\'s uploads for this farmer', async () => {
        mockFarmerAccess.mockResolvedValue(servedFarmer);
        database(
            sql => (sql.includes('SELECT farmer_id, duration_minutes') ? { rows: [{ farmer_id: FARMER_ID }] } : undefined),
            sql => (sql.includes('FROM upload_records') ? { rows: [] } : undefined),
        );

        const res = await request(app).patch(`/api/v1/visits/${VISIT_ID}`).set(officer)
            .send({ outcomes: 'Findings', attachmentIds: [UPLOAD_ID] });

        expect(res.status).toBe(400);
        expect(mockQuery.mock.calls.some(call => String(call[0]).startsWith('UPDATE visits SET'))).toBe(false);
    });

    it('rejects a follow-up date that is not a calendar date', async () => {
        const res = await request(app).patch(`/api/v1/visits/${VISIT_ID}`).set(officer)
            .send({ followUpRequired: true, followUpDate: 'next week' });
        expect(res.status).toBe(400);
    });
});

describe('AI rate limit scope in chat', () => {
    // Imported lazily: the module under test is the chatbot router's own helper.
    const { isAiGenerationRoute } = jest.requireActual('../routes/chatbot/index');

    it('applies to the routes that call an AI provider', () => {
        expect(isAiGenerationRoute({ method: 'POST', path: '/completions' })).toBe(true);
        expect(isAiGenerationRoute({ method: 'POST', path: '/public-demo/stt' })).toBe(true);
        expect(isAiGenerationRoute({ method: 'POST', path: '/conversations/c-1/ask-ai' })).toBe(true);
    });

    it('does not apply to reading threads or to messages between people', () => {
        expect(isAiGenerationRoute({ method: 'POST', path: '/messages' })).toBe(false);
        expect(isAiGenerationRoute({ method: 'GET', path: '/conversations' })).toBe(false);
        expect(isAiGenerationRoute({ method: 'GET', path: '/conversations/c-1/messages' })).toBe(false);
        expect(isAiGenerationRoute({ method: 'PATCH', path: '/messages/m-1' })).toBe(false);
    });
});
