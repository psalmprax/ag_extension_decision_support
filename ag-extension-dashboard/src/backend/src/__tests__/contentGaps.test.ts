jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));

import { query } from '@/services/databaseService';
import { contentGapReport, recordContentGap, topWords } from '@/services/content/contentGaps';

const mockQuery = query as jest.Mock;
beforeEach(() => mockQuery.mockReset());

describe('content gaps', () => {
    it('are noted without who asked', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await recordContentGap({ question: 'When do I plant beans in Mzimba?', crop: 'Beans', country: 'Malawi', language: 'en', role: 'farmer' });
        expect(mockQuery.mock.calls[0][1]).toEqual(['When do I plant beans in Mzimba?', 'beans', 'Malawi', 'en', 'farmer']);
    });

    it('are grouped by crop and country, largest first, with the words that recur', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [
            { crop: 'maize', country: 'Malawi', question: 'Armyworm in maize funnel, what spray?' },
            { crop: 'maize', country: 'Malawi', question: 'How to control armyworm on young maize' },
            { crop: 'maize', country: 'Malawi', question: 'Armyworm again after rain' },
            { crop: 'beans', country: 'Malawi', question: 'Bean rust spots' },
        ] });
        const groups = await contentGapReport(90, 'Malawi');
        expect(groups[0]).toMatchObject({ crop: 'maize', questions: 3 });
        expect(groups[0].topWords[0]).toEqual({ word: 'armyworm', count: 3 });
        expect(mockQuery.mock.calls[0][1]).toEqual([90, 'Malawi']);
    });

    it('ignores words that carry no topic', () => {
        expect(topWords(['what is the best way', 'what is the time'])).toEqual([]);
    });
});

describe('knowledge routes', () => {
    it('serve /quarantine and /content-gaps before the article page takes them as ids', () => {
        jest.isolateModules(() => {
            const { listRoutes } = require('@/utils/routeInventory');
            const router = require('@/routes/knowledge').default;
            const routes: string[] = listRoutes(router);
            const articlePage = routes.indexOf('GET /:id');
            expect(routes.indexOf('GET /quarantine')).toBeLessThan(articlePage);
            expect(routes.indexOf('GET /content-gaps')).toBeLessThan(articlePage);
            expect(routes.indexOf('GET /content-gaps')).toBeGreaterThanOrEqual(0);
        });
    });
});
