import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import synthesisRouter from '@/routes/ai/synthesis';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { SemanticCacheService } from '@/services/semanticCacheService';

jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIRouter: { routeRequest: jest.fn() },
}));

jest.mock('@/services/usageService', () => ({
    usageService: { incrementUsage: jest.fn(async () => undefined) },
}));

jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('@/services/semanticCacheService', () => ({
    SemanticCacheService: {
        findExact: jest.fn(),
        findSimilar: jest.fn(),
        save: jest.fn(async () => undefined),
    },
}));

const mockRouteRequest = AIRouter.routeRequest as jest.MockedFunction<typeof AIRouter.routeRequest>;
const mockFindExact = SemanticCacheService.findExact as jest.MockedFunction<typeof SemanticCacheService.findExact>;
const mockFindSimilar = SemanticCacheService.findSimilar as jest.MockedFunction<typeof SemanticCacheService.findSimilar>;
const mockSave = SemanticCacheService.save as jest.MockedFunction<typeof SemanticCacheService.save>;

let currentUser = 'officer-a';
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: currentUser, email: `${currentUser}@example.test`, role: 'extension_officer' };
    next();
});
app.use('/api/ai', synthesisRouter);

const NOTES = 'Visited the maize plot of farmer Ama. Leaves show yellow streaks on the lower canopy, some fall armyworm frass in the whorls.';
const AI_REPLY = JSON.stringify({
    summary: 'Maize plot with fall armyworm signs.',
    keyObservations: ['Frass in whorls'],
    recommendedActions: ['Scout 20 plants per field and record the share with fresh damage'],
    cropHealthStatus: 'fair',
    pestIssues: 'Fall armyworm',
    followUpRequired: true,
    nextVisitDateHint: 'One week',
});

describe('POST /api/ai/synthesize-visit cache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = 'officer-a';
        mockFindExact.mockResolvedValue(null);
        mockRouteRequest.mockResolvedValue({ text: AI_REPLY } as Awaited<ReturnType<typeof AIRouter.routeRequest>>);
    });

    it('never answers from a merely similar visit (it could be another officer\'s farmer)', async () => {
        mockFindSimilar.mockResolvedValue({ queryText: 'other notes', answer: JSON.stringify({ summary: 'Another farm' }), contextUsed: null });

        const res = await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(res.status).toBe(200);
        expect(res.body.source).not.toBe('cache');
        expect(mockFindSimilar).not.toHaveBeenCalled();
        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
    });

    it('stores and looks up the summary under the officer and the exact notes', async () => {
        await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(mockFindExact).toHaveBeenCalledWith(`visit-synthesis:officer-a:${NOTES}`);
        expect(mockSave).toHaveBeenCalledWith(`visit-synthesis:officer-a:${NOTES}`, expect.any(String), expect.objectContaining({ userId: 'officer-a' }));
    });

    it('returns the stored summary when the same officer sends the same notes again', async () => {
        const stored = { summary: 'Stored summary' };
        mockFindExact.mockResolvedValue({ queryText: 'k', answer: JSON.stringify(stored), contextUsed: null });

        const res = await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(res.body).toEqual({ success: true, data: stored, source: 'cache' });
        expect(mockRouteRequest).not.toHaveBeenCalled();
    });

    it('makes a new summary when the stored one is not valid JSON', async () => {
        mockFindExact.mockResolvedValue({ queryText: 'k', answer: 'not json', contextUsed: null });

        const res = await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(res.status).toBe(200);
        expect(res.body.source).not.toBe('cache');
        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
    });

    it('does not share a summary between officers who send the same notes', async () => {
        currentUser = 'officer-b';
        await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(mockFindExact).toHaveBeenCalledWith(`visit-synthesis:officer-b:${NOTES}`);
    });
});
