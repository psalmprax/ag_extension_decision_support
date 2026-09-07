import { sanitizeContextText } from '../services/knowledge/textNormalize';
import { buildExtractiveAnswer } from '../services/knowledge/insightExtract';
import type { SearchResult } from '../services/vectorService';

function localDoc(): SearchResult {
    return {
        id: 'local-1',
        content: 'Farmer cooperatives enhance bargaining power and access to larger markets through collective marketing and bulk input purchase.',
        metadata: { title: 'Market Access Guide', category: 'Marketing', crop: 'All', sourceUrl: 'https://example.org', contentType: 'text' },
        score: 0.8,
    };
}

describe('extractive answer hygiene (cooperative-query review)', () => {
    describe('sanitizeContextText', () => {
        it('strips interview speaker labels from Q&A lines but keeps the content', () => {
            const cleaned = sanitizeContextText('AFN: What about the biggest challenge for young farmers?');
            expect(cleaned).not.toMatch(/^AFN:/);
            expect(cleaned).toContain('What about the biggest challenge for young farmers?');
        });

        it('leaves declarative attributions like USDA untouched', () => {
            const cleaned = sanitizeContextText('USDA: The new conservation guidance recommends cover cropping.');
            expect(cleaned).toContain('USDA:');
        });

        it('repairs truncated parentheticals such as (SMS/)', () => {
            const cleaned = sanitizeContextText('Market information systems (SMS/) providing daily wholesale prices.');
            expect(cleaned).toContain('(SMS)');
            expect(cleaned).not.toContain('(SMS/)');
        });
    });

    describe('procedural guidance notes (via buildExtractiveAnswer)', () => {
        it('labels the cooperative roadmap as general reference with jurisdiction examples', () => {
            const { answer } = buildExtractiveAnswer('What are the steps for starting a farmer cooperative?', [localDoc()]);
            expect(answer).toContain('Standard cooperative formation protocol (general reference');
            expect(answer).toContain('Kenya');
            expect(answer).toContain('Nigeria');
            expect(answer).toContain('Ghana');
            expect(answer).not.toContain('cooperative authority/ministry');
        });

        it('labels soil and spray protocols as general reference', () => {
            const soil = buildExtractiveAnswer('What is the standard soil testing procedure?', [localDoc()]);
            expect(soil.answer).toContain('Standard soil sampling protocol (general reference)');
            const spray = buildExtractiveAnswer('What is the safe pesticide spray procedure?', [localDoc()]);
            expect(spray.answer).toContain('Standard safe-spraying protocol (general reference');
        });

        it('adds no protocol note for non-procedural queries', () => {
            const { answer } = buildExtractiveAnswer('What is the maize price today?', [localDoc()]);
            expect(answer).not.toContain('general reference');
        });
    });
});
