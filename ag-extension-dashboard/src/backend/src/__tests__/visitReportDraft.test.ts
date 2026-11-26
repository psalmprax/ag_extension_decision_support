import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import visitReportDraftRouter from '@/routes/ai/visitReportDraft';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { assembleDraft, splitSentences } from '@/services/visitReportDraft';
import { usageService } from '@/services/usageService';
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

const mockRouteRequest = jest.mocked(AIRouter.routeRequest);
const reply = (text: string): TextGenerationResult => ({ text, model: 'test-model', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } });

let role: 'extension_officer' | 'farmer' = 'extension_officer';
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: 'officer-a', email: 'officer-a@example.test', role };
    next();
});
app.use('/api/ai', visitReportDraftRouter);

const TRANSCRIPT = 'Maize is at knee height. I found armyworm in about a third of the plants. I showed the farmer how to scout twenty plants. I was there forty minutes. Come back in two weeks.';

describe('splitSentences', () => {
    it('keeps each sentence with its own words and punctuation', () => {
        expect(splitSentences('Maize is tall.  Leaves are yellow!\nSoil dry')).toEqual(['Maize is tall.', 'Leaves are yellow!', 'Soil dry']);
    });

    it('splits Amharic and Arabic full stops', () => {
        expect(splitSentences('በቆሎ ደርሷል። ተባይ አለ።')).toHaveLength(2);
        expect(splitSentences('الذرة جيدة؟ نعم')).toHaveLength(2);
    });
});

describe('assembleDraft', () => {
    const sentences = splitSentences(TRANSCRIPT);

    it('builds the report from the officer\'s sentences only', () => {
        const draft = assembleDraft(sentences, { findings: [1, 2], actions: [3], minutesOnFarm: 40, followUpInDays: 14 });
        expect(draft.findings).toBe('Maize is at knee height. I found armyworm in about a third of the plants. I was there forty minutes. Come back in two weeks.');
        expect(draft.actions).toBe('I showed the farmer how to scout twenty plants.');
        expect(draft).toMatchObject({ minutesOnFarm: 40, followUpRequired: true, followUpInDays: 14, organised: true });
    });

    it('ignores sentence numbers that do not exist and values outside sensible ranges', () => {
        const draft = assembleDraft(sentences, { actions: [3, 99, -1, 2.5, '4'], minutesOnFarm: 5000, followUpInDays: 0 });
        expect(draft.actions).toBe('I showed the farmer how to scout twenty plants.');
        expect(draft).toMatchObject({ minutesOnFarm: null, followUpInDays: null, followUpRequired: null });
    });

    it('keeps everything under findings when the sentences could not be sorted', () => {
        expect(assembleDraft(sentences, null)).toEqual({
            findings: sentences.join(' '), actions: '', minutesOnFarm: null, followUpRequired: null, followUpInDays: null, organised: false,
        });
    });

    it('drops the follow-up date when the officer said no follow-up is needed', () => {
        expect(assembleDraft(sentences, { followUpRequired: false, followUpInDays: 7 })).toMatchObject({ followUpRequired: false, followUpInDays: null });
    });
});

describe('POST /api/ai/draft-visit-report', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        role = 'extension_officer';
    });

    it('returns the sorted report and never text the model wrote', async () => {
        mockRouteRequest.mockResolvedValue(reply('Sure: {"findings":[1,2],"actions":[3],"minutesOnFarm":40,"followUpRequired":true,"followUpInDays":14,"summary":"Apply 5 kg of urea"}'));

        const res = await request(app).post('/api/ai/draft-visit-report').send({ transcript: TRANSCRIPT });

        expect(res.status).toBe(200);
        expect(res.body.data.actions).toBe('I showed the farmer how to scout twenty plants.');
        expect(JSON.stringify(res.body.data)).not.toContain('urea');
        expect(usageService.incrementUsage).toHaveBeenCalledWith('officer-a', 'ai_chat');
    });

    it('still returns the whole recording under findings when the model is unavailable, without counting usage', async () => {
        mockRouteRequest.mockRejectedValue(new Error('no provider'));

        const res = await request(app).post('/api/ai/draft-visit-report').send({ transcript: TRANSCRIPT });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ findings: splitSentences(TRANSCRIPT).join(' '), actions: '', organised: false });
        expect(usageService.incrementUsage).not.toHaveBeenCalled();
    });

    it('rejects an empty transcript', async () => {
        const res = await request(app).post('/api/ai/draft-visit-report').send({ transcript: '   ' });
        expect(res.status).toBe(400);
    });

    it('is not open to farmers', async () => {
        role = 'farmer';
        const res = await request(app).post('/api/ai/draft-visit-report').send({ transcript: TRANSCRIPT });
        expect(res.status).toBe(403);
    });
});
