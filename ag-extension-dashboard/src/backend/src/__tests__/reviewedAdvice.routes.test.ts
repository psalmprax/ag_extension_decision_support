import express from 'express';
import request from 'supertest';
import { query, withTransaction } from '../services/databaseService';
import { getFarmerForPrincipal } from '../services/dataGovernanceService';
import { VectorService } from '../services/vectorService';
import { countryOfUser } from '../services/country/countryContext';
import { findPersonalDetails } from '../services/knowledge/reviewedAnswers';

jest.mock('../services/databaseService', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../services/dataGovernanceService', () => ({
    getFarmerForPrincipal: jest.fn(),
    getPrincipalTenantId: jest.fn(),
}));
jest.mock('../services/vectorService', () => ({ VectorService: { upsertDocument: jest.fn() } }));
jest.mock('../services/country/countryContext', () => ({ countryOfUser: jest.fn() }));
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../middleware/authorize', () => ({
    authorize: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = { userId: String(req.headers['x-user']), role: String(req.headers['x-role']), isDemo: req.headers['x-demo'] === '1' } as express.Request['user'];
        next();
    },
}));

import reviewsRouter from '../routes/recommendationReviews';

const app = express();
app.use(express.json());
app.use('/ai/reviews', reviewsRouter);

const mockQuery = query as jest.Mock;
const mockTransaction = withTransaction as jest.Mock;
const mockFarmer = getFarmerForPrincipal as jest.Mock;
const mockUpsert = VectorService.upsertDocument as jest.Mock;
const mockCountry = countryOfUser as jest.Mock;
const client = { query: jest.fn() };

const as = (role: string, user = 'u-' + role) => ({ 'x-role': role, 'x-user': user });

const ADVICE = {
    title: 'Fall armyworm scouting at the whorl stage',
    content: 'Scout 20 plants in a W pattern each week and record the share with fresh window-pane damage and live larvae. '
        + 'Hand-pick egg masses where practical and confirm the local action threshold with the extension office.',
    crops: ['maize'],
    sources: 'KALRO fall armyworm field guide, 2021',
};

function reviewRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'r1', status: 'approved', farmer_id: 'f1', reviewed_by: 'agronomist-1', reviewed_at: '2026-11-20T09:00:00Z',
        knowledge_article_id: null, first_name: 'Wanjiru', last_name: 'Kamau', phone: '+254 712 345 678',
        farmer_country: 'Kenya', reviewer_first_name: 'Achieng', reviewer_last_name: 'Otieno',
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockFarmer.mockResolvedValue({ id: 'f1', tenant_id: 't1' });
    mockCountry.mockResolvedValue(null);
    mockUpsert.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (callback: (c: typeof client) => Promise<unknown>) => callback(client));
    client.query.mockReset()
        .mockResolvedValueOnce({ rows: [{ knowledge_article_id: null }] })
        .mockResolvedValueOnce({ rows: [{ id: 'article-1' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
});

describe('adding approved advice to the knowledge base', () => {
    it('saves it for document review, with who approved it, when, and its sources', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reviewRow()] });

        const res = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(ADVICE);

        expect(res.status).toBe(201);
        expect(res.body.data).toEqual({ knowledgeArticleId: 'article-1', pendingReview: true });
        const [insertSql, params] = client.query.mock.calls[1]!;
        expect(insertSql).toContain('INSERT INTO knowledge_articles');
        expect(params[0]).toBe(ADVICE.title);
        expect(params[1]).toContain('Sources: KALRO fall armyworm field guide, 2021');
        expect(params[4]).toEqual(['reviewed_answer', 'pending_review']);
        expect(params[5]).toEqual(['maize']);
        expect(params[6]).toEqual(['Kenya']);
        expect(params[7]).toBe('Advice approved by Achieng Otieno, 2026-11-20');
        expect(client.query.mock.calls[2]).toEqual(['UPDATE recommendation_reviews SET knowledge_article_id = $1 WHERE id = $2', ['article-1', 'r1']]);
        expect(mockUpsert).toHaveBeenCalledWith('article-1', expect.any(String), expect.objectContaining({ tags: ['reviewed_answer', 'pending_review'] }));
    });

    it('still saves it when the embedding cannot be made (keyword search finds it; the backfill embeds it)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reviewRow()] });
        mockUpsert.mockRejectedValueOnce(new Error('embedding provider out of credit'));

        const res = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(ADVICE);

        expect(res.status).toBe(201);
    });

    it("refuses text with the farmer's name, a phone number or an email address", async () => {
        mockQuery.mockResolvedValue({ rows: [reviewRow()] });
        const withName = { ...ADVICE, content: `${ADVICE.content} Wanjiru should check again on Friday.` };

        const res = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(withName);

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("the farmer's name");
        expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('only accepts approved advice', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reviewRow({ status: 'dismissed' })] });
        const res = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(ADVICE);
        expect(res.status).toBe(409);
    });

    it('lets only the approving agronomist or a manager add it', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reviewRow()] });
        const officer = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'officer-2')).send(ADVICE);
        expect(officer.status).toBe(403);

        mockQuery.mockResolvedValueOnce({ rows: [reviewRow()] });
        const manager = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('regional_manager', 'manager-1')).send(ADVICE);
        expect(manager.status).toBe(201);
    });

    it('adds it once', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reviewRow({ knowledge_article_id: 'article-0' })] });
        const res = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(ADVICE);
        expect(res.status).toBe(409);

        mockQuery.mockResolvedValueOnce({ rows: [reviewRow()] });
        client.query.mockReset().mockResolvedValueOnce({ rows: [{ knowledge_article_id: 'article-0' }] });
        const raced = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(ADVICE);
        expect(raced.status).toBe(409);
        expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('hides reviews about farmers the person may not see', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [reviewRow()] });
        mockFarmer.mockResolvedValueOnce(null);
        const res = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send(ADVICE);
        expect(res.status).toBe(404);
    });

    it('needs a title and enough advice, and is closed to farmers and the demo', async () => {
        const short = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('extension_officer', 'agronomist-1')).send({ ...ADVICE, content: 'Scout weekly.' });
        expect(short.status).toBe(400);
        const farmer = await request(app).post('/ai/reviews/r1/knowledge-article').set(as('farmer')).send(ADVICE);
        expect(farmer.status).toBe(403);
        const demo = await request(app).post('/ai/reviews/r1/knowledge-article').set({ ...as('extension_officer'), 'x-demo': '1' }).send(ADVICE);
        expect(demo.status).toBe(403);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('personal details in shared text', () => {
    const farmer = { first_name: 'Ama', last_name: 'Mensah', phone: '024 123 4567' };

    it('finds the farmer\'s name as a whole word, any phone number and email addresses', () => {
        expect(findPersonalDetails('Tell ama to scout again.', farmer)).toEqual(["the farmer's name"]);
        expect(findPersonalDetails('Call 0241234567 for help.', farmer)).toEqual(['a phone number']);
        expect(findPersonalDetails('Write to agent@example.org.', farmer)).toEqual(['an email address']);
    });

    it('does not flag ordinary agronomic text', () => {
        expect(findPersonalDetails('Plant in rows 75 cm apart with 25 cm between plants; scout 20 plants weekly from 2 to 8 weeks.', farmer)).toEqual([]);
        expect(findPersonalDetails('Amaranth and mensahweed are not names here.', farmer)).toEqual([]);
    });
});
