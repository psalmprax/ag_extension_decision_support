import { enqueueAdvisoryReview, reviewTriggerFor } from '../services/knowledge/reviewQueue';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockQuery = query as jest.Mock;

describe('reviewTriggerFor', () => {
    const grounded = { status: 'retrieved_not_independently_verified', invalidReferences: false };

    it('queues safety-flagged advice first, whatever its sources', () => {
        expect(reviewTriggerFor(grounded, false)).toBe('safety_boundary');
    });

    it('queues answers that cite sources they were not given', () => {
        expect(reviewTriggerFor({ ...grounded, invalidReferences: true }, true)).toBe('invalid_references');
    });

    it('queues answers with no retrieved sources', () => {
        expect(reviewTriggerFor({ status: 'general_guidance_only', invalidReferences: false }, true)).toBe('no_sources');
    });

    it('does not queue cleanly sourced answers', () => {
        expect(reviewTriggerFor(grounded, true)).toBeNull();
    });
});

describe('enqueueAdvisoryReview', () => {
    beforeEach(() => mockQuery.mockReset());

    it('inserts against the conversation\'s farmer and tenant with the trigger', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
        const id = await enqueueAdvisoryReview({ conversationId: 'c1', createdBy: 'u1', recommendation: 'advice', trigger: 'no_sources' });
        expect(id).toBe('r1');
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('JOIN farmers f ON f.id = cv.farmer_id');
        expect(params).toEqual(['c1', 'u1', 'advice', 'no_sources']);
    });

    it('queues nothing for a conversation without a farmer', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(enqueueAdvisoryReview({ conversationId: 'c2', createdBy: 'u1', recommendation: 'x', trigger: 'no_sources' })).resolves.toBeNull();
    });

    it('never throws, so the farmer still gets the answer', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));
        await expect(enqueueAdvisoryReview({ conversationId: 'c3', createdBy: 'u1', recommendation: 'x', trigger: 'safety_boundary' })).resolves.toBeNull();
    });

    it('caps very long recommendations at the column limit', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r4' }] });
        await enqueueAdvisoryReview({ conversationId: 'c4', createdBy: 'u1', recommendation: 'a'.repeat(12000), trigger: 'no_sources' });
        expect((mockQuery.mock.calls[0][1][2] as string).length).toBe(10000);
    });
});
