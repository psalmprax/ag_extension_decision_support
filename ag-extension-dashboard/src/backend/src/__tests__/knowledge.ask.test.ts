import express from 'express';
import request from 'supertest';
import router from '@/routes/knowledge/search';
import { KnowledgeService } from '@/services/knowledgeService';
import { usageService } from '@/services/usageService';

jest.mock('@/services/knowledgeService', () => ({
    KnowledgeService: { askQuestion: jest.fn() },
    getKnowledgeEvidenceStatus: jest.fn(() => 'context_only'),
}));
jest.mock('@/services/usageService', () => ({
    usageService: {
        checkDailyKnowledgeLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 3, limit: 3 }),
        recordKnowledgeSearch: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('@/services/cacheService', () => ({ cacheGet: jest.fn(), cacheSet: jest.fn() }));
jest.mock('@/services/databaseService', () => ({ getPool: jest.fn(), query: jest.fn() }));
jest.mock('@/services/tavilyService', () => ({ tavilyService: {} }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const app = express();
app.use(express.json(), (req, _res, next) => {
    Object.assign(req, { user: { userId: 'farmer-1', role: 'farmer' } });
    next();
});
app.use('/knowledge', router);

describe('Knowledge answer availability', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 503 without charging quota when no answer is available', async () => {
        jest.mocked(KnowledgeService.askQuestion).mockResolvedValueOnce({
            answer: 'The assistant is unavailable.', reasoning: '', contextUsed: [], cached: false,
            answerMode: 'unavailable',
        });

        const res = await request(app).post('/knowledge/ask').send({ question: 'Maize advice' });

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('unavailable');
        expect(res.body.data).toBeUndefined();
        expect(usageService.recordKnowledgeSearch).not.toHaveBeenCalled();
    });

    it.each(['generated', 'extractive'] as const)('preserves %s answer mode and quota accounting', async answerMode => {
        jest.mocked(KnowledgeService.askQuestion).mockResolvedValueOnce({
            answer: 'Scout maize fields.', reasoning: '', contextUsed: [], cached: false, answerMode,
        });

        const res = await request(app).post('/knowledge/ask').send({ question: 'Maize advice' });

        expect(res.status).toBe(200);
        expect(res.body.data.answerMode).toBe(answerMode);
        expect(res.body.data.dailyRemaining).toBe(2);
        expect(usageService.recordKnowledgeSearch).not.toHaveBeenCalled();
    });
});
