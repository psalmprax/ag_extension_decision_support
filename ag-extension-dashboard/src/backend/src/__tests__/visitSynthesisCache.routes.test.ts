import { createHash } from 'crypto';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import synthesisRouter from '@/routes/ai/synthesis';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { SemanticCacheService } from '@/services/semanticCacheService';
import type { TextGenerationResult } from '@/services/aiProvider/types';

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

const mockRouteRequest = jest.mocked(AIRouter.routeRequest);
const mockFindExact = jest.mocked(SemanticCacheService.findExact);
const mockFindSimilar = jest.mocked(SemanticCacheService.findSimilar);
const mockSave = jest.mocked(SemanticCacheService.save);

let currentUser = 'officer-a';
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: currentUser, email: `${currentUser}@example.test`, role: 'extension_officer' };
    next();
});
app.use('/api/ai', synthesisRouter);

const NOTES = 'Visited the maize plot of farmer Ama. Leaves show yellow streaks on the lower canopy, some fall armyworm frass in the whorls.';
/** A complete visit summary, as the route stores and returns it. */
const SUMMARY = {
    summary: 'Maize plot with fall armyworm signs.',
    keyObservations: ['Frass in whorls'],
    recommendedActions: ['Scout 20 plants per field and record the share with fresh damage'],
    cropHealthStatus: 'fair',
    pestIssues: 'Fall armyworm',
    followUpRequired: true,
    nextVisitDateHint: 'One week',
};
/** What the router returns for a 'generate' request. */
const PROVIDER_REPLY: TextGenerationResult = {
    text: JSON.stringify(SUMMARY),
    model: 'test-model',
    usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
};
const keyFor = (officer: string, notes: string) =>
    `visit-synthesis:${officer}:${createHash('sha256').update(notes).digest('hex')}`;
const stored = (answer: string) => ({ queryText: 'k', answer, contextUsed: null });

describe('POST /api/ai/synthesize-visit cache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = 'officer-a';
        mockFindExact.mockResolvedValue(null);
        mockRouteRequest.mockResolvedValue(PROVIDER_REPLY);
    });

    it('never answers from a merely similar visit (it could be another officer\'s farmer)', async () => {
        mockFindSimilar.mockResolvedValue({ queryText: 'other notes', answer: JSON.stringify({ ...SUMMARY, summary: 'Another farm' }), contextUsed: null });

        const res = await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(res.status).toBe(200);
        expect(res.body.source).not.toBe('cache');
        expect(mockFindSimilar).not.toHaveBeenCalled();
        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
    });

    it('stores and looks up the summary under the officer and a digest of the exact notes', async () => {
        await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(mockFindExact).toHaveBeenCalledWith(keyFor('officer-a', NOTES));
        expect(mockSave).toHaveBeenCalledWith(keyFor('officer-a', NOTES), expect.any(String), expect.objectContaining({ userId: 'officer-a' }));
        expect(mockSave.mock.calls[0]![0]).not.toContain('farmer Ama');
    });

    it('keeps notes that differ only in case apart, even though the cache lower-cases keys', async () => {
        await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });
        await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES.toUpperCase() });

        const [first, second] = mockFindExact.mock.calls.map(call => call[0]);
        expect(first).not.toBe(second);
        expect(first!.toLowerCase()).not.toBe(second!.toLowerCase());
    });

    it('returns the stored summary when the same officer sends the same notes again', async () => {
        mockFindExact.mockResolvedValue(stored(JSON.stringify(SUMMARY)));

        const res = await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(res.body).toEqual({ success: true, data: SUMMARY, source: 'cache' });
        expect(mockRouteRequest).not.toHaveBeenCalled();
    });

    it.each([
        ['is not valid JSON', 'not json'],
        ['is only a summary line', JSON.stringify({ summary: 'Stored summary' })],
        ['has an unknown crop health status', JSON.stringify({ ...SUMMARY, cropHealthStatus: 'excellent' })],
        ['has observations that are not a list', JSON.stringify({ ...SUMMARY, keyObservations: 'Frass in whorls' })],
    ])('makes a new summary when the stored one %s', async (_reason, answer) => {
        mockFindExact.mockResolvedValue(stored(answer));

        const res = await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(res.status).toBe(200);
        expect(res.body.source).not.toBe('cache');
        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
    });

    it('does not share a summary between officers who send the same notes', async () => {
        currentUser = 'officer-b';
        await request(app).post('/api/ai/synthesize-visit').send({ notes: NOTES });

        expect(mockFindExact).toHaveBeenCalledWith(keyFor('officer-b', NOTES));
    });
});
