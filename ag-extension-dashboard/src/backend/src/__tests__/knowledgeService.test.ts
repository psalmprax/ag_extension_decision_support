import { getKnowledgeEvidenceStatus, KnowledgeService } from '../services/knowledgeService';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/aiProvider/aiProvider', () => ({
    AIRouter: {
        routeRequest: jest.fn(),
    },
}));

jest.mock('../services/vectorService', () => ({
    VectorService: {
        hybridSearch: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../services/semanticCacheService', () => ({
    SemanticCacheService: {
        findSimilar: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../services/assetValidationService', () => ({
    AssetValidationService: {
        validateAssetUrls: jest.fn().mockResolvedValue([]),
        getRelevantImages: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../services/cacheService', () => ({
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/databaseService', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../services/tavilyService', () => ({
    tavilyService: {
        isConfigured: jest.fn().mockReturnValue(false),
        search: jest.fn().mockResolvedValue({ results: [] }),
    },
}));

jest.mock('../services/stealthScraperService', () => ({
    StealthScraperService: {
        scrapeKnowledge: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import { AIRouter } from '../services/aiProvider/aiProvider';
import { logger } from '../utils/logger';
import { VectorService } from '../services/vectorService';
import { cacheGet } from '../services/cacheService';

const mockRouteRequest = AIRouter.routeRequest as jest.MockedFunction<typeof AIRouter.routeRequest>;
const mockLoggerWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;
const mockLoggerError = logger.error as jest.MockedFunction<typeof logger.error>;

// ─── Test fixtures ───────────────────────────────────────────────────────────

const fastClassificationLabels = [
    { label: 'agronomy_and_yield', score: 0.92 },
    { label: 'climate_and_weather', score: 0.45 },
];

const timeoutError = new Error('categorizeQuery timed out after 10000ms');

describe('KnowledgeService evidence status', () => {
    it('requires citations before marking an answer as verified', () => {
        expect(getKnowledgeEvidenceStatus(2, 0)).toBe('verified_sources');
        expect(getKnowledgeEvidenceStatus(0, 2)).toBe('context_only');
        expect(getKnowledgeEvidenceStatus(0, 0)).toBe('no_verified_source');
    });
});

// ─── categorizeQuery timeout wrapper tests ───────────────────────────────────

describe('KnowledgeService.categorizeQuery — timeout wrapper (10s)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns labels above 0.4 threshold when AI responds quickly', async () => {
        mockRouteRequest.mockResolvedValue({ labels: fastClassificationLabels });

        const result = await KnowledgeService.categorizeQuery('What crops grow in dry conditions?');

        // Both labels have scores > 0.4
        expect(result).toEqual(['agronomy_and_yield', 'climate_and_weather']);
        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('falls back to ["general_inquiry"] when AI classification times out (>10s)', async () => {
        // Simulate a timeout by rejecting with the same error the race would produce
        mockRouteRequest.mockRejectedValue(timeoutError);

        const result = await KnowledgeService.categorizeQuery('What is the weather?');

        expect(result).toEqual(['general_inquiry']);
        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.stringContaining('categorizeQuery timeout')
        );
    });

    it('falls back to ["general_inquiry"] on unexpected AI errors', async () => {
        mockRouteRequest.mockRejectedValue(new Error('AI provider unavailable'));

        const result = await KnowledgeService.categorizeQuery('Test query');

        expect(result).toEqual(['general_inquiry']);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'categorizeQuery failed:',
            expect.any(Error)
        );
    });

    it('returns only labels with scores above 0.4 threshold', async () => {
        mockRouteRequest.mockResolvedValue({
            labels: [
                { label: 'pest_and_disease', score: 0.88 },
                { label: 'agronomy_and_yield', score: 0.76 },
                { label: 'general_inquiry', score: 0.12 },
            ],
        });

        const result = await KnowledgeService.categorizeQuery('Pest control for maize');

        // general_inquiry (0.12) filtered out by threshold
        expect(result).toEqual(['pest_and_disease', 'agronomy_and_yield']);
    });

    it('returns empty array when all labels are below threshold', async () => {
        mockRouteRequest.mockResolvedValue({
            labels: [
                { label: 'general_inquiry', score: 0.35 },
                { label: 'pest_and_disease', score: 0.20 },
            ],
        });

        const result = await KnowledgeService.categorizeQuery('Hello');

        expect(result).toEqual([]);
    });
});

// ─── askQuestion reasoning timeout wrapper tests ─────────────────────────────

describe('KnowledgeService.askQuestion — reasoning timeout wrapper (60s)', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mocks for supporting services
        (VectorService.hybridSearch as jest.Mock).mockResolvedValue([
            {
                id: 'doc-1',
                content: 'Maize requires well-drained soil and regular rainfall of 500-1000mm annually.',
                metadata: { title: 'Maize Growing Guide', category: 'Agronomy', crop: 'maize', sourceUrl: 'https://example.com', contentType: 'text' },
                score: 0.85,
            },
        ]);

        (cacheGet as jest.Mock).mockResolvedValue(null);
    });

    it('returns the reasoning result when AI responds within the 60s window', async () => {
        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') {
                return { labels: [{ label: 'agronomy_and_yield', score: 0.92 }] };
            }
            if (type === 'reason') {
                return {
                    reasoning: 'Analysis completed.',
                    answer: 'Maize and beans grow well in Central region with proper soil preparation.',
                    confidence: 0.85,
                    visuals: null,
                };
            }
            return {};
        });

        const result = await KnowledgeService.askQuestion('user-1', 'What grows well in Central?');

        expect(result.answer).toContain('Maize and beans');
        expect(result.cached).toBe(false);
        expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('falls back to extractive answer when reasoning rejects with timeout error', async () => {
        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') {
                return { labels: [{ label: 'agronomy_and_yield', score: 0.92 }] };
            }
            if (type === 'reason') {
                // Simulate the timeout wrapper rejecting
                throw new Error('askQuestion reasoning timed out after 60000ms');
            }
            return {};
        });

        const result = await KnowledgeService.askQuestion('user-1', 'Maize growing conditions');

        // Should fall back to extractive answer using the mocked context
        expect(result.answer).toContain('Maize');
        expect(result.contextUsed.length).toBeGreaterThan(0);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'RAG analysis failed:',
            expect.any(Error)
        );
    });

    it('falls back to extractive answer on unexpected reasoning error', async () => {
        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') {
                return { labels: [{ label: 'agronomy_and_yield', score: 0.92 }] };
            }
            if (type === 'reason') {
                throw new Error('LLM provider returned 500');
            }
            return {};
        });

        const result = await KnowledgeService.askQuestion('user-1', 'Maize diseases');

        expect(result.answer).toContain('Maize');
        expect(mockLoggerError).toHaveBeenCalled();
    });

    it('returns graceful fallback when both reasoning and context retrieval fail', async () => {
        // No context available
        (VectorService.hybridSearch as jest.Mock).mockResolvedValue([]);

        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') {
                return { labels: [{ label: 'agronomy_and_yield', score: 0.92 }] };
            }
            if (type === 'reason') {
                throw new Error('askQuestion reasoning timed out after 60000ms');
            }
            return {};
        });

        const result = await KnowledgeService.askQuestion('user-1', 'Something completely unknown');
        expect(result.answer).toContain('wasn\'t able to find information');
        expect(result.contextUsed).toEqual([]);
    });

    it('sanitizes noisy crawler context, excludes title metadata from takeaways, and injects cooperative formation roadmap', async () => {
        (VectorService.hybridSearch as jest.Mock).mockResolvedValue([
            {
                id: 'coop-1',
                content: `Title: Farmer Cooperatives and Collective Marketing - Farming Tips\n\nJoining a farmer cooperative boosts your bargaining power. * Farmer cooperatives enhance bargaining power and access to larger, more profitable markets through collective marketing. * Cooperatives reduce individual costs by negotiating bulk transportation, storage, and processing services. #### farm cooperative marketing tools. At Agrosahas International PVT LTD, we are committed to promoting cooperatives. Kukuchku Animal Feeds and Concentrates recognizes the essential role farmers play [...]`,
                metadata: {
                    title: 'Farmer Cooperatives and Collective Marketing - Farming Tips',
                    category: 'cooperatives',
                    crop: 'all',
                    sourceUrl: 'https://farmingtips.org/farming/farmer-cooperatives-marketing'
                },
                score: 0.88,
            }
        ]);

        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') {
                return { labels: [{ label: 'agronomy_and_yield', score: 0.90 }] };
            }
            if (type === 'reason') {
                throw new Error('Provider timeout');
            }
            return {};
        });

        const query = 'What are the steps for starting a farmer cooperative, and how can it help us access better markets?';
        const result = await KnowledgeService.askQuestion('user-1', query);

        // 1. Must NOT have raw "Title: Farmer Cooperatives" as an extracted takeaway
        expect(result.answer).not.toMatch(/- \*\*Title\*\*:/);
        expect(result.answer).not.toContain('Title: Farmer Cooperatives and Collective Marketing');

        // 2. Must clean vendor boilerplate and crawler ellipsis
        expect(result.answer).not.toContain('At Agrosahas International PVT LTD');
        expect(result.answer).not.toContain('Kukuchku Animal Feeds');
        expect(result.answer).not.toContain('[...]');

        // 3. Must extract substantive takeaways
        expect(result.answer).toContain('Farmer cooperatives enhance bargaining power and access to larger');
        expect(result.answer).toContain('Cooperatives reduce individual costs by negotiating bulk transportation');

        // 4. Must inject procedural implementation roadmap in sentence case (not all capital letters or title case)
        expect(result.answer).toContain('Field advisory implementation roadmap (standard cooperative formation)');
        expect(result.answer).toContain('Mobilization');
        expect(result.answer).toContain('Constitution and bylaws');

        // 5. Must use sentence case for section headings instead of title-casing every word
        expect(result.answer).toContain('### Key identified insights and takeaways');
        expect(result.answer).toContain('### Verified context and field reference');
        expect(result.answer).toContain('*Primary source reference:');
    });

    it('normalizes all-caps headings and uppercase blocks into clean sentence case', async () => {
        (VectorService.hybridSearch as jest.Mock).mockResolvedValue([
            {
                id: 'allcaps-1',
                content: `### HOW DO COOPERATIVES ADAPT TO MARKET CHANGES?\n\nJOINING A FARMER COOPERATIVE BOOSTS BARGAINING POWER AND INCOME STABILITY FOR ALL PRODUCERS.`,
                metadata: {
                    title: 'FARMER COOPERATIVES AND COLLECTIVE MARKETING',
                    category: 'cooperatives',
                    crop: 'all',
                    sourceUrl: 'https://example.org/coops'
                },
                score: 0.88,
            }
        ]);

        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') return { labels: [{ label: 'agronomy_and_yield', score: 0.90 }] };
            if (type === 'reason') throw new Error('Timeout');
            return {};
        });

        const result = await KnowledgeService.askQuestion('user-1', 'How do cooperatives adapt?');

        // Scraped all-caps heading in body must not remain in ALL CAPS
        expect(result.answer).not.toContain('### HOW DO COOPERATIVES ADAPT TO MARKET CHANGES?');
        expect(result.answer).not.toContain('HOW DO COOPERATIVES ADAPT TO MARKET CHANGES?');
        expect(result.answer).toContain('How do cooperatives adapt to market changes?');

        // Body text must not remain in ALL CAPS
        expect(result.answer).not.toContain('JOINING A FARMER COOPERATIVE BOOSTS BARGAINING POWER');
        expect(result.answer).toContain('Joining a farmer cooperative boosts bargaining power');

        // Metadata title must not remain in ALL CAPS
        expect(result.answer).not.toContain('FARMER COOPERATIVES AND COLLECTIVE MARKETING');
        expect(result.answer).toContain('Farmer cooperatives and collective marketing');
    });

    it('passes attachments through to the reasoning call', async () => {
        const reasoningSpy = jest.fn().mockResolvedValue({
            reasoning: 'Analysis from image.',
            answer: 'The image shows signs of nitrogen deficiency.',
            confidence: 0.9,
            visuals: null,
        });

        mockRouteRequest.mockImplementation(async (type: string, opts?: { attachments?: unknown[] }) => {
            if (type === 'classify') {
                return { labels: [{ label: 'pest_and_disease', score: 0.95 }] };
            }
            if (type === 'reason') {
                return reasoningSpy(type, opts);
            }
            return {};
        });

        const attachment = { type: 'image' as const, data: 'base64data', mimeType: 'image/jpeg' };
        await KnowledgeService.askQuestion('user-1', 'What is wrong with my crop?', [attachment]);

        // Verify the reasoning call received the attachment
        const reasonCall = reasoningSpy.mock.calls[0];
        expect(reasonCall[1].attachments).toEqual([attachment]);
    });

    it('bypasses exact cache when bypassCache option is true', async () => {
        (cacheGet as jest.Mock).mockResolvedValue(JSON.stringify({
            reasoning: 'Cached analysis',
            answer: 'Cached answer',
            confidence: 0.9,
            visuals: null,
            contextUsed: [],
            cached: true,
        }));

        mockRouteRequest.mockImplementation(async (type: string) => {
            if (type === 'classify') {
                return { labels: [{ label: 'agronomy_and_yield', score: 0.92 }] };
            }
            if (type === 'reason') {
                return {
                    reasoning: 'Fresh live reasoning.',
                    answer: 'Fresh live answer.',
                    confidence: 0.95,
                    visuals: null,
                };
            }
            return {};
        });

        const result = await KnowledgeService.askQuestion('user-1', 'What grows well in Central?', undefined, { bypassCache: true });
        expect(result.answer).toBe('Fresh live answer.');
        expect(result.cached).toBe(false);
    });
});
