import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the translate package
vi.mock('translate', () => ({
    default: Object.assign(
        vi.fn().mockResolvedValue('Mazungumzo ya kilimo'),
        { engine: 'google' }
    ),
}));

import { translateText } from '@/lib/translationUtils';

describe('translationUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('translateText', () => {
        it('should translate text to target language', async () => {
            const result = await translateText('Agricultural chat', 'sw');

            expect(result).toBe('Mazungumzo ya kilimo');
        });

        it('should return original text on translation failure', async () => {
            const translate = (await import('translate')).default;
            vi.mocked(translate).mockRejectedValueOnce(new Error('Translation service unavailable'));

            const result = await translateText('Hello', 'sw');

            expect(result).toBe('Hello');
        });

        it('should handle empty input', async () => {
            const result = await translateText('', 'sw');

            // Empty string is passed to translate, result depends on mock
            expect(typeof result).toBe('string');
        });
    });
});
