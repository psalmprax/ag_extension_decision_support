import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import router from '@/routes/knowledgeSync';
import { KnowledgeSyncOrchestrator } from '@/services/data/knowledgeSyncOrchestrator';
import { TropicalKnowledgeSourceService } from '@/services/data/tropicalKnowledgeSources';
import { faostatService } from '@/services/data/faostatService';
import { VectorService } from '@/services/vectorService';
import { query } from '@/services/databaseService';

jest.mock('@/middleware/authorize', () => ({
    authorize: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: jest.fn() } }));
jest.mock('@/services/data/faostatService', () => ({
    faostatService: { generateCountryArticles: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const app = express();
app.use('/sync', router);

const article = {
    title: 'Crop Production Statistics - Malawi',
    content: 'Example data',
    category: 'Production Data',
    crops: ['maize'],
    regions: ['Malawi'],
    source: 'FAOSTAT API' as const,
    sourceUrl: 'https://example.test',
};

describe('knowledge synchronization', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.mocked(query).mockReset();
        jest.mocked(VectorService.upsertDocument).mockReset().mockResolvedValue();
        jest.mocked(faostatService.generateCountryArticles).mockReset().mockResolvedValue([article]);
        jest.spyOn(TropicalKnowledgeSourceService, 'seedSourcesFromStatic').mockResolvedValue(2);
        jest.spyOn(TropicalKnowledgeSourceService, 'syncCuratedArticles').mockResolvedValue({ synced: 1, articles: [] });
    });

    it('uses stable, source-specific IDs on repeated runs and reports actual inserted sources', async () => {
        const first = await KnowledgeSyncOrchestrator.syncAll();
        await KnowledgeSyncOrchestrator.syncAll();
        const calls = jest.mocked(VectorService.upsertDocument).mock.calls;
        expect(calls[0][0]).toBe(calls[1][0]);
        expect(first).toEqual({ tropicalSources: 2, tropicalArticles: 1, faostatArticles: 1, totalEmbeddings: 2 });
        jest.mocked(faostatService.generateCountryArticles).mockResolvedValue([
            { ...article, source: 'FAOSTAT 2022 static fallback' },
        ]);
        await KnowledgeSyncOrchestrator.syncAll();
        expect(jest.mocked(VectorService.upsertDocument).mock.calls[2][0]).not.toBe(calls[0][0]);
    });

    it('reports a failed write as HTTP 500 and permits a retry', async () => {
        jest.mocked(VectorService.upsertDocument).mockRejectedValueOnce(new Error('database unavailable'));
        const failed = await request(app).post('/sync');
        expect(failed.status).toBe(500);
        expect(failed.body.success).not.toBe(true);
        expect(KnowledgeSyncOrchestrator.getStatus().inProgress).toBe(false);
        const retry = await request(app).post('/sync');
        expect(retry.status).toBe(200);
        expect(retry.body.success).toBe(true);
    });

    it('returns HTTP 409 for overlapping syncs in the same process', async () => {
        let release!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        jest.mocked(faostatService.generateCountryArticles).mockImplementationOnce(async () => {
            await pending;
            return [article];
        });
        const first = KnowledgeSyncOrchestrator.syncAll();
        try {
            const response = await request(app).post('/sync');
            expect(response.status).toBe(409);
            expect(response.body.success).not.toBe(true);
        } finally {
            release();
            await first;
        }
    });

    it('propagates source-seeding failures instead of reporting success', async () => {
        jest.mocked(TropicalKnowledgeSourceService.seedSourcesFromStatic).mockRejectedValueOnce(new Error('seed failure'));
        const response = await request(app).post('/sync');
        expect(response.status).toBe(500);
        expect(jest.mocked(faostatService.generateCountryArticles)).not.toHaveBeenCalled();
    });
});
