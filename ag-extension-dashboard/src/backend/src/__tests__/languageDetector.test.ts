import { detectLanguage } from '../utils/languageDetector';

describe('Language Detection', () => {
    describe('Swahili detection', () => {
        it('detects Swahili text with agricultural keywords', () => {
            const result = detectLanguage('maziwa na ngamia shamba');
            expect(result.language).toBe('sw');
            expect(result.confidence).toBeGreaterThan(50);
        });

        it('detects Swahili text with crop disease terms', () => {
            const result = detectLanguage('kilimo una uchawi');
            expect(result.language).toBe('sw');
        });
    });

    describe('English detection', () => {
        it('detects English text with agricultural keywords', () => {
            const result = detectLanguage('crop disease fertilizer harvest');
            expect(result.language).toBe('en');
            expect(result.confidence).toBeGreaterThan(50);
        });

        it('detects English text with pest terms', () => {
            const result = detectLanguage('white spots on leaves pest');
            expect(result.language).toBe('en');
        });
    });

    describe('French detection', () => {
        it('detects French text with agricultural keywords', () => {
            const result = detectLanguage('maladie des cultures engrais');
            expect(result.language).toBe('fr');
            expect(result.confidence).toBeGreaterThan(50);
        });
    });

    describe('Mixed language text', () => {
        it('defaults to English when languages are evenly matched', () => {
            // Balanced text should default to English
            const result = detectLanguage('crop farm soil water');
            expect(result.language).toBe('en');
        });

        it('handles empty text gracefully', () => {
            const result = detectLanguage('');
            expect(result.language).toBe('en');
            expect(result.confidence).toBe(0);
        });

        it('handles null/undefined text gracefully', () => {
            const result = detectLanguage(undefined as unknown as string);
            expect(result.language).toBe('en');
        });
    });

    describe('Indicators', () => {
        it('provides language indicator scores', () => {
            const result = detectLanguage('maziwa kilimo');
            expect(result.indicators).toHaveProperty('en');
            expect(result.indicators).toHaveProperty('sw');
            expect(result.indicators).toHaveProperty('fr');
        });

        it('provides reasonable indicator values', () => {
            const result = detectLanguage('maziwa');
            expect(result.indicators.sw).toBeGreaterThan(result.indicators.en);
            expect(result.indicators.sw).toBeGreaterThan(result.indicators.fr);
        });
    });
});
