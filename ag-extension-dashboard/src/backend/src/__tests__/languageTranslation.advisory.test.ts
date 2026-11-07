import express from 'express';
import request from 'supertest';
import languageRouter from '@/routes/language';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { cacheGet, cacheSet } from '@/services/cacheService';

jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIRouter: { routeRequest: jest.fn().mockResolvedValue({ text: 'Translated advisory.' }) },
}));
jest.mock('@/services/cacheService', () => ({
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/language', languageRouter);

describe('Advisory translation integrity', () => {
    beforeEach(() => jest.clearAllMocks());

    it('keys the full text and source language rather than just the first 500 characters', async () => {
        const prefix = 'a'.repeat(500);
        for (const body of [
            { text: `${prefix}first`, sourceLanguage: 'en', targetLanguage: 'sw' },
            { text: `${prefix}second`, sourceLanguage: 'en', targetLanguage: 'sw' },
            { text: `${prefix}first`, sourceLanguage: 'fr', targetLanguage: 'sw' },
        ]) {
            expect((await request(app).post('/language/translate').send(body)).status).toBe(200);
        }
        expect(new Set(jest.mocked(cacheGet).mock.calls.map(([key]) => key)).size).toBe(3);
        expect(AIRouter.routeRequest).toHaveBeenCalledWith('generate', expect.objectContaining({
            options: expect.objectContaining({ preferredProvider: 'aihubmix' }),
        }));
    });

    it.each([{ text: '' }, { text: 'Incomplete', finishReason: 'length' }])(
        'rejects empty or truncated model output', async output => {
            jest.mocked(AIRouter.routeRequest).mockResolvedValueOnce(output);
            const result = await request(app).post('/language/translate').send({ text: 'Maize advice', targetLanguage: 'sw' });
            expect(result.status).toBe(500);
            expect(cacheSet).not.toHaveBeenCalled();
        }
    );
});
