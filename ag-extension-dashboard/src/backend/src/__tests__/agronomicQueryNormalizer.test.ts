import { normalizeAgronomicQuery, isAgronomicContent, prepareWebSearchQuery } from '../utils/agronomicQueryNormalizer';

describe('agronomicQueryNormalizer', () => {
    describe('normalizeAgronomicQuery', () => {
        it('corrects "farners" to "farmers"', () => {
            const result = normalizeAgronomicQuery('what are challenges Nigeria farners face?');
            expect(result).toBe('what are challenges Nigeria farmers face?');
        });

        it('corrects "fetilizer" and "casava" typos', () => {
            const result = normalizeAgronomicQuery('how to apply fetilizer on casava');
            expect(result).toBe('how to apply fertilizer on cassava');
        });

        it('corrects "pestisides" and "maiz"', () => {
            const result = normalizeAgronomicQuery('best pestisides for maiz stemborer');
            expect(result).toBe('best pesticides for maize stemborer');
        });

        it('preserves clean queries without modification', () => {
            const query = 'fall armyworm control in maize';
            expect(normalizeAgronomicQuery(query)).toBe(query);
        });

        it('handles empty or non-string inputs safely', () => {
            expect(normalizeAgronomicQuery('')).toBe('');
            expect(normalizeAgronomicQuery(null as unknown as string)).toBe('');
        });
    });

    describe('isAgronomicContent', () => {
        it('identifies agricultural content correctly', () => {
            expect(isAgronomicContent('Best practices for maize stem borer control')).toBe(true);
            expect(isAgronomicContent('Cassava Mosaic and Brown Streak Disease Field Guide')).toBe(true);
            expect(isAgronomicContent('Post-harvest storage for smallholders using hermetic bags')).toBe(true);
            expect(isAgronomicContent('NPK fertilizer application rates per hectare')).toBe(true);
        });

        it('rejects non-agricultural content (tailoring, boutique retail, military identity)', () => {
            expect(isAgronomicContent('Top Challenges Tailors Face in Nigeria + Solution: Record customer measurements for repeat business. Fashion trends evolve quickly, and tailors who do not upgrade skills risk becoming irrelevant.')).toBe(false);
            expect(isAgronomicContent('5 Challenges Women Entrepreneurs Face In Starting And Growing Their Businesses In Nigeria - salon and boutique owners')).toBe(false);
            expect(isAgronomicContent('Security Challenges Nigeria Must Face: Identity - Hussein Solomon, Governance Reforms May Be Effective Than Military in Countering Boko Haram')).toBe(false);
        });

        it('rejects farmers-market retail-venture content even though it mentions farmers', () => {
            expect(isAgronomicContent('[pdf] how to start a farmers market business - sdg.azte.co Starting a farmers market business requires careful planning, a clear understanding of local regulations, and effective marketing strategies for farmers.')).toBe(false);
        });

        it('keeps legitimate market-access content mentioning farmers and retailers', () => {
            expect(isAgronomicContent('Smallholder market linkage requires collective marketing through farmer cooperatives to achieve volume for bulk buyers. Digital platforms connect farmers directly to urban retailers, increasing farm-gate price.')).toBe(true);
            expect(isAgronomicContent('What are the steps for starting a farmer cooperative, and how can it help us access better markets?')).toBe(true);
        });
    });

    describe('prepareWebSearchQuery', () => {
        it('leaves agricultural query untouched', () => {
            expect(prepareWebSearchQuery('what are challenges Nigeria farmers face?')).toBe('what are challenges Nigeria farmers face?');
        });

        it('corrects typo in query before sending', () => {
            expect(prepareWebSearchQuery('what are challenges Nigeria farners face?')).toBe('what are challenges Nigeria farmers face?');
        });

        it('anchors ambiguous queries with agriculture and farming', () => {
            expect(prepareWebSearchQuery('challenges in Ogun state')).toBe('challenges in Ogun state agriculture farming');
        });
    });
});
