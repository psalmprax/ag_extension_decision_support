import {
    buildAdvisoryDirective,
    buildAdvisoryEvidence,
    resolveAdvisoryCountry,
    validateAdvisoryCitations,
} from '@/services/knowledge/advisoryPolicy';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';
import type { SearchResult } from '@/services/vectorService';

function source(id: string, metadata: Record<string, unknown> = {}): SearchResult {
    return {
        id, content: 'Scout the crop and confirm the pest before choosing a treatment.',
        score: 0.99, metadata: { title: 'Extension guidance', ...metadata },
    };
}

describe('Agricultural advisory quality policy', () => {
    it.each(['Kenya', 'Nigeria', 'India', 'Canada', 'Brazil', 'Germany', 'Australia', 'Japan'])(
        'applies local-label safeguards to %s without assuming US climate zones',
        country => {
            const prompt = buildAdvisoryDirective({ country });
            expect(prompt).toContain(country);
            expect(prompt).toContain('NOT authorization in another');
            expect(prompt).toContain('locally registered label');
            expect(prompt).toContain('not universal months or US hardiness zones');
        }
    );

    it('lets an explicit question country override the profile hint', () => {
        expect(resolveAdvisoryCountry('I grow maize in India', 'Kenya')).toBe('India');
        expect(resolveAdvisoryCountry('Help me identify leaf damage', 'KE')).toBe('Kenya');
        expect(resolveAdvisoryCountry('Compare Kenya and India')).toBeUndefined();
        expect(resolveAdvisoryCountry('Help me identify leaf damage')).toBeUndefined();
    });

    it.each([
        ['Je cultive du maïs en Allemagne.', 'Germany'],
        ['我在中国种玉米。', 'China'],
        ['भारत में मक्का उगाता हूँ।', 'India'],
        ['Cultivo milho no Brasil.', 'Brazil'],
        ['Uprawiam kukurydzę w Polsce.', 'Poland'],
    ])('resolves localized location: %s', (question, expected) => {
        expect(resolveAdvisoryCountry(question, 'Kenya')).toBe(expected);
    });

    it('uses the latest explicit country rather than mixing historical countries', () => {
        expect(resolveAdvisoryCountry('Now I grow maize in India', 'Kenya', ['My farm is in Kenya'])).toBe('India');
        expect(resolveAdvisoryCountry('What should I scout?', undefined, ['Kenya', 'India'])).toBe('India');
        expect(resolveAdvisoryCountry('Compare Kenya and India', 'Kenya', ['India'])).toBeUndefined();
    });

    it('keeps distinct chunks of an article under one citation', () => {
        const first = source('article', { country: 'Kenya' });
        const second = { ...first, content: 'Inspect the underside of leaves for eggs.' };
        const evidence = buildAdvisoryEvidence([first, second, first], { country: 'Kenya' });
        expect(evidence.citations).toHaveLength(1);
        expect(evidence.context).toContain(first.content);
        expect(evidence.context).toContain(second.content);
    });

    it('excludes quarantined, foreign-jurisdiction and duplicate sources', () => {
        const result = buildAdvisoryEvidence([
            source('local', { jurisdiction: 'KE' }),
            source('local', { jurisdiction: 'KE' }),
            source('foreign', { country: 'India' }),
            source('regional-foreign', { regions: ['Canada'] }),
            source('unverified', { tags: ['unverified_scrape'] }),
            source('old-faostat', { source: 'FAOSTAT 2022 static fallback' }),
            source('api-faostat', { source: 'FAOSTAT API' }),
            source('general'),
        ], { country: 'Kenya' });
        expect(result.documents.map(document => document.id)).toEqual(['local', 'general']);
        expect(result.context).toContain('not proof of local applicability');
        expect(result.context).toContain('source date: not established');
        expect(result.citations[0]?.sourceId).toBe('local');
    });

    it('does not attach fabricated source numbers or links to an answer', () => {
        const evidence = buildAdvisoryEvidence([source('local', { sourceUrl: 'https://example.org/guide' })]);
        const result = validateAdvisoryCitations(
            'Scout first [1]. A guaranteed cure [99]: https://invented.example/cure',
            evidence.citations
        );
        expect(result.answer).toContain('[1]');
        expect(result.answer).not.toContain('[99]');
        expect(result.answer).not.toContain('https://invented.example');
        expect(result.evidence.invalidReferences).toBe(true);
        expect(result.evidence.citedSourceNumbers).toEqual([1]);
        expect(result.evidence.regulatoryAuthorization).toBe('not_established');
    });

    it('discloses zero evidence instead of calling a fluent answer verified', () => {
        const result = validateAdvisoryCitations('Inspect both sides of affected leaves.', []);
        expect(result.evidence.status).toBe('general_guidance_only');
        expect(result.answer).toContain('no eligible source');
    });

    it.each([
        'Apply neem oil at 3 ml/L.',
        'Apply 2.5 tonnes of lime per hectare.',
        'Apply 100 kg/ha of urea.',
        'Tumia mafuta ya mwarobaini mililita 3 kwa lita moja.',
        'Appliquez 2 litres de pesticide.',
        'Use pesticide with a PHI of 7 days.',
        'कीटनाशक 3 मिलीलीटर प्रति लीटर पानी मिलाकर छिड़कें।',
        '每升水加入3毫升杀虫剂并喷洒。',
        'Aplique dos litros de pesticida por hectárea.',
        'Pestizid mit zwei Litern Wasser mischen.',
        'اخلط ٣ ملليلتر من مبيد لكل لتر ماء.',
        'Применяйте пестицид три литра на гектар.',
        'Dodaj dwa litry pestycydu na hektar.',
        '用三毫升农药兑水。',
        'Apply ３ ml/L of pesticide.',
        'Apply 3ml/L of pesticide.',
        'Mix one teaspoon of pesticide.',
        'Use insecticide at a 2% concentration.',
        'Mix a 2% neem solution.',
        'Apply 5% insecticide.',
        'At 20% of plants affected, apply neem at 3 ml/L.',
        'At 20% of plants affected, spray a 2% insecticide solution.',
    ])('withholds an unverified treatment prescription: %s', advice => {
        const result = agronomicSafetyGuard.guardAndEnrichAdvice(advice);
        expect(result.boundaryCheck.safe).toBe(false);
        expect(result.text).not.toContain(advice);
        expect(result.text).toContain('cannot verify');
    });

    it('keeps useful low-risk scouting advice and ordinary measurements', () => {
        const advice = 'Scout 10 plants in several parts of the field; take clear photos of damaged leaves.';
        expect(agronomicSafetyGuard.guardAndEnrichAdvice(advice).text).toBe(advice);
        expect(agronomicSafetyGuard.scanGeneratedAdvice('The recorded yield was 5 kg/ha.').safe).toBe(true);
    });

    it.each([
        '20% of plants affected',
        '20% of sampled plants with fresh damage',
        '20 % damaged plants',
        '20% infestation',
        '20% of whorls with live larvae',
        '２０％ of plants affected',
    ])('distinguishes scouting percentages from pesticide concentrations: %s', threshold => {
        const advice = `An example scouting threshold is ${threshold} [1]. This is not a universal spray trigger. Confirm local guidance before choosing an insecticide.`;
        const result = agronomicSafetyGuard.guardAndEnrichAdvice(advice);

        expect(result.boundaryCheck.safe).toBe(true);
        expect(result.text).toContain(advice);
        expect(result.text).not.toContain('cannot verify a treatment rate');
    });

    it('instructs synthesis to distinguish action thresholds from treatment rates', () => {
        const directive = buildAdvisoryDirective();
        expect(directive).toContain('Distinguish scouting/action thresholds');
        expect(directive).toContain('Do not invent a universal threshold');
    });

    it('localizes treatment withholding and evidence disclosure', () => {
        const guarded = agronomicSafetyGuard.guardAndEnrichAdvice('每升水加入3毫升杀虫剂并喷洒。', 'zh-CN');
        expect(guarded.text).toContain('请勿使用未经核实的剂量');
        expect(validateAdvisoryCitations(guarded.text, [], 'zh-CN').answer).toContain('未检索到适用来源');
    });
});
