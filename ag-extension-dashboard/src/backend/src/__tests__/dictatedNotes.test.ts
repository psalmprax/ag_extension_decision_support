jest.mock('@/services/usageService', () => ({
    usageService: { checkLimit: jest.fn().mockResolvedValue({ allowed: true }), incrementUsage: jest.fn().mockResolvedValue(undefined) },
}));
const generateText = jest.fn().mockResolvedValue({ text: 'Maize is at knee height; fall armyworm on five plants.' });
jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIProviderFactory: { getWithFallback: jest.fn((run: (p: unknown) => unknown) => run({ generateText })) },
}));

import { withEnglishSummary } from '@/services/visits/dictatedNotes';
import { usageService } from '@/services/usageService';

describe('dictated visit notes', () => {
    beforeEach(() => jest.clearAllMocks());

    it('keep the spoken words and add a marked English summary', async () => {
        const notes = await withEnglishSummary('Mahindi yamefika magoti, viwavijeshi kwenye mimea mitano', 'sw', 'officer-1');
        expect(notes).toMatch(/^Mahindi yamefika magoti/);
        expect(notes).toContain('English summary (AI, check against the recording): Maize is at knee height');
        expect(usageService.incrementUsage).toHaveBeenCalledWith('officer-1', 'ai_chat');
    });

    it('are left alone in English, or when the AI allowance is used up', async () => {
        await expect(withEnglishSummary('Maize at knee height', 'en', 'officer-1')).resolves.toBe('Maize at knee height');
        (usageService.checkLimit as jest.Mock).mockResolvedValueOnce({ allowed: false });
        await expect(withEnglishSummary('Mahindi', 'sw', 'officer-1')).resolves.toBe('Mahindi');
        expect(generateText).not.toHaveBeenCalled();
    });
});
