import { isQuarantined } from '@/services/knowledge/groundingPolicy';

describe('guides waiting for review do not ground answers', () => {
    const result = (tags: string[]) => ({ id: 'a', content: 'Plant at the first rains.', score: 1, metadata: { tags } });

    it('withholds an officer’s upload until a manager or administrator approves it', () => {
        expect(isQuarantined(result(['pending_review']) as never)).toBe(true);
        expect(isQuarantined(result(['maize']) as never)).toBe(false);
    });
});
