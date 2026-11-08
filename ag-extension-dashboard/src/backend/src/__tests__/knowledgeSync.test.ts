import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import router from '@/routes/knowledgeSync';
import { KnowledgeSyncOrchestrator } from '@/services/data/knowledgeSyncOrchestrator';
import { TropicalKnowledgeSourceService } from '@/services/data/tropicalKnowledgeSources';
import { faostatService } from '@/services/data/faostatService';
import { VectorService } from '@/services/vectorService';
import { query } from '@/services/databaseService';
import { acquireKnowledgeSyncLock, isKnowledgeSyncLocked } from '@/services/data/knowledgeSyncLock';

jest.mock('@/middleware/authorize', () => ({
    authorize: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: jest.fn() } }));
jest.mock('@/services/data/faostatService', () => ({
    faostatService: { generateCountryArticles: jest.fn() },
}));
jest.mock('@/services/data/knowledgeSyncLock', () => ({
    acquireKnowledgeSyncLock: jest.fn(),
    isKnowledgeSyncLocked: jest.fn(),
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
        jest.mocked(acquireKnowledgeSyncLock).mockReset().mockResolvedValue({
            assertHeld: jest.fn(), release: jest.fn().mockResolvedValue(undefined),
        });
        jest.mocked(isKnowledgeSyncLocked).mockReset().mockResolvedValue(false);
        jest.spyOn(TropicalKnowledgeSourceService, 'seedSourcesFromStatic').mockResolvedValue(2);
        jest.spyOn(TropicalKnowledgeSourceService, 'syncCuratedArticles').mockResolvedValue({ synced: 1, articles: [] });
    });

    it('uses stable, source-specific IDs on repeated runs and reports actual inserted sources', async () => {
        const first = await KnowledgeSyncOrchestrator.syncAll();
        await KnowledgeSyncOrchestrator.syncAll();
        const calls = jest.mocked(VectorService.upsertDocument).mock.calls;
        expect(calls[0][0]).toBe(calls[1][0]);
        expect(first).toEqual({ tropicalSources: 2, tropicalArticles: 1, faostatArticles: 1, totalEmbeddings: 2, faostatDataStatus: 'api' });
        jest.mocked(faostatService.generateCountryArticles).mockResolvedValue([
            { ...article, source: 'FAOSTAT 2022 static fallback' },
        ]);
        await KnowledgeSyncOrchestrator.syncAll();
        expect(jest.mocked(VectorService.upsertDocument).mock.calls[2][0]).not.toBe(calls[0][0]);
    });

    it('reports historical fallback and unavailable sources explicitly', async () => {
        jest.mocked(faostatService.generateCountryArticles).mockResolvedValueOnce([
            { ...article, source: 'FAOSTAT 2022 static fallback' },
        ]).mockResolvedValueOnce([]);
        expect((await KnowledgeSyncOrchestrator.syncAll()).faostatDataStatus).toBe('historical_fallback');
        expect((await KnowledgeSyncOrchestrator.syncAll()).faostatDataStatus).toBe('unavailable');
        jest.mocked(faostatService.generateCountryArticles).mockResolvedValueOnce([
            article, { ...article, source: 'FAOSTAT 2022 static fallback' },
        ]);
        expect((await KnowledgeSyncOrchestrator.syncAll()).faostatDataStatus).toBe('mixed');
    });

    it('reports a failed write as HTTP 500 and permits a retry', async () => {
        jest.mocked(VectorService.upsertDocument).mockRejectedValueOnce(new Error('database unavailable'));
        const failed = await request(app).post('/sync');
        expect(failed.status).toBe(500);
        expect(failed.body.success).not.toBe(true);
        expect((await KnowledgeSyncOrchestrator.getStatus()).inProgress).toBe(false);
        const retry = await request(app).post('/sync');
        expect(retry.status).toBe(200);
        expect(retry.body.success).toBe(true);
    });

    it('reports a sync running on another instance and refuses overlap', async () => {
        jest.mocked(acquireKnowledgeSyncLock).mockResolvedValueOnce(null);
        jest.mocked(isKnowledgeSyncLocked).mockResolvedValueOnce(true);
        expect((await request(app).post('/sync')).status).toBe(409);
        const status = await request(app).get('/sync/status');
        expect(status.body.data).toMatchObject({ inProgress: true, lastSyncScope: 'process' });
        expect(TropicalKnowledgeSourceService.seedSourcesFromStatic).not.toHaveBeenCalled();
    });

    it('fails and releases the lock if its connection is lost during work', async () => {
        const release = jest.fn().mockResolvedValue(undefined);
        const assertHeld = jest.fn()
            .mockImplementationOnce(() => undefined)
            .mockImplementationOnce(() => { throw new Error('lock lost'); });
        jest.mocked(acquireKnowledgeSyncLock).mockResolvedValueOnce({ assertHeld, release });
        expect((await request(app).post('/sync')).status).toBe(500);
        expect(release).toHaveBeenCalledTimes(1);
        expect(TropicalKnowledgeSourceService.syncCuratedArticles).not.toHaveBeenCalled();
    });

    it('reports an unlock failure and allows a later retry', async () => {
        jest.mocked(acquireKnowledgeSyncLock).mockResolvedValueOnce({
            assertHeld: jest.fn(), release: jest.fn().mockRejectedValue(new Error('unlock failed')),
        });
        expect((await request(app).post('/sync')).status).toBe(500);
        expect((await request(app).post('/sync')).status).toBe(200);
    });

    it('reports a database status lookup failure', async () => {
        jest.mocked(isKnowledgeSyncLocked).mockRejectedValueOnce(new Error('database unavailable'));
        const response = await request(app).get('/sync/status');
        expect(response.status).toBe(500);
        expect(response.body.success).not.toBe(true);
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
