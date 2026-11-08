import { createHash } from 'crypto';
import { query } from '../services/databaseService';
import { ASK_HELP, messagingKnowledgeReply, parseAskCommand } from '../services/knowledge/messagingHints';

jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.mock('../services/regulatoryProvenanceService', () => ({ regulatoryProvenanceService: {} }));

const mockQuery = query as jest.Mock;
const article = {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb01',
    title: 'Maize scouting',
    content: 'Inspect maize leaves for damage.',
    tags: [],
};
const digest = createHash('sha256').update(JSON.stringify([article.title, article.content])).digest('hex');
const hint = { articleId: article.id, sha256: digest, source: 'Public field guide', hint: 'Inspect maize leaves regularly.' };

describe('public messaging knowledge hints', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        process.env.MESSAGING_KB_PUBLIC_HINTS = JSON.stringify([hint]);
    });
    afterEach(() => { delete process.env.MESSAGING_KB_PUBLIC_HINTS; });

    it('recognizes explicit commands and gives instructions for an empty question', async () => {
        expect(parseAskCommand('/ASK maize')).toBe('maize');
        expect(parseAskCommand('ASK')).toBe('');
        expect(parseAskCommand('asking maize')).toBeNull();
        expect(await messagingKnowledgeReply('')).toBe(ASK_HELP);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns only the separately approved hint for the matching unchanged article', async () => {
        mockQuery.mockResolvedValue({ rows: [article] });
        const reply = await messagingKnowledgeReply('maize leaves');
        expect(reply).toContain('Public field guide');
        expect(reply).toContain(hint.hint);
        expect(reply).not.toContain(article.content);
        expect(reply).toContain('Not a diagnosis');
        expect(mockQuery.mock.calls[0][1]).toEqual([[article.id], 'maize leaves']);
        expect(mockQuery.mock.calls[0][0]).toContain("NOT ('unverified_scrape' = ANY(tags))");
    });

    it.each([
        { ...article, content: 'changed private content' },
        { ...article, id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb02' },
        { ...article, tags: ['unverified_scrape'] },
    ])('withholds changed, unapproved and quarantined sources', async row => {
        mockQuery.mockResolvedValue({ rows: [row] });
        expect(await messagingKnowledgeReply('maize')).toContain('No approved public knowledge hint');
    });

    it('withholds unsafe treatment hints even if approved', async () => {
        process.env.MESSAGING_KB_PUBLIC_HINTS = JSON.stringify([{ ...hint, hint: 'Spray a fungicide now.' }]);
        mockQuery.mockResolvedValue({ rows: [article] });
        expect(await messagingKnowledgeReply('maize')).toContain('No approved public knowledge hint');
    });

    it('fails closed without configuration and does not search the private corpus', async () => {
        delete process.env.MESSAGING_KB_PUBLIC_HINTS;
        expect(await messagingKnowledgeReply('maize')).toContain('No approved public knowledge hint');
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('reports invalid configuration and retrieval errors as unavailable', async () => {
        process.env.MESSAGING_KB_PUBLIC_HINTS = '{';
        expect(await messagingKnowledgeReply('maize')).toContain('temporarily unavailable');
        process.env.MESSAGING_KB_PUBLIC_HINTS = JSON.stringify([hint]);
        mockQuery.mockRejectedValue(new Error('database unavailable'));
        expect(await messagingKnowledgeReply('maize')).toContain('temporarily unavailable');
    });

    it('reports a retrieval timeout as unavailable', async () => {
        jest.useFakeTimers();
        try {
            mockQuery.mockReturnValue(new Promise(() => {}));
            const reply = messagingKnowledgeReply('maize');
            await jest.advanceTimersByTimeAsync(4000);
            expect(await reply).toContain('temporarily unavailable');
        } finally {
            jest.useRealTimers();
        }
    });
});
