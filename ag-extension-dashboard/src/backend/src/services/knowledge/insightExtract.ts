import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import type { SearchResult } from '@/services/vectorService';
import { isAgronomicContent } from '@/utils/agronomicQueryNormalizer';
import {
    METADATA_LABELS,
    convertAllCapsLine,
    isMostlyUppercase,
    normalizeAllCapsText,
    sanitizeContextText,
    toSentenceCase,
} from '@/services/knowledge/textNormalize';

/**
 * Extractive fallback: synthesize a source-backed answer from retrieved chunks
 * when the AI provider does not complete in time.
 */

export function parseInsightFromLine(line: string): string | null {
    const trimmed = line.trim();
    if (trimmed.length < 25 || trimmed.length > 400) return null;

    // Check if it is an existing bullet/list item
    const bulletMatch = trimmed.match(/^([*•-]|(?:\d+\.))\s+(.+)/s);
    const textContent = (bulletMatch ? bulletMatch[2].trim() : trimmed)
        .replace(/^#{1,6}\s+/, '')
        .trim();

    // Check for Label: Detail pattern
    const headingMatch = textContent.match(/^([A-Z][A-Za-z0-9\s–—/-]{2,40}):\s*(.+)/s);
    if (headingMatch) {
        let label = headingMatch[1].trim();
        if (METADATA_LABELS.has(label.toLowerCase())) return null;

        if (isMostlyUppercase(label)) {
            label = toSentenceCase(label);
        }

        const detail = headingMatch[2].trim().replace(/\s+/g, ' ');
        if (detail.length < 20) return null;
        return `- **${label}**: ${detail}`;
    }

    // If it was an explicit bullet item from the source with good advisory signal
    if (bulletMatch && textContent.length >= 35) {
        if (/^(read\s+more|share\s+on|click\s+here|http)/i.test(textContent)) return null;
        return `- ${textContent.replace(/\s+/g, ' ')}`;
    }

    return null;
}

export function getProceduralGuidanceNote(queryText: string): string | null {
    const q = queryText.toLowerCase();
    const asksForSteps = /\b(steps?|how to|procedure|guide|process)\b/i.test(q);
    if (!asksForSteps) return null;

    if (/\b(cooperative|co-op|collective|group farm|association)\b/i.test(q)) {
        return `> **Field advisory implementation roadmap (standard cooperative formation):**\n` +
            `> 1. **Mobilization**: Bring together 10–20 core producers facing shared market or input challenges.\n` +
            `> 2. **Steering committee**: Elect an interim committee to record decisions and draft rules.\n` +
            `> 3. **Feasibility assessment**: Survey member crop acreage, expected harvest volumes, and shared storage/transport needs.\n` +
            `> 4. **Constitution and bylaws**: Define membership qualifications, one-member-one-vote rules, share capital, and side-selling penalties.\n` +
            `> 5. **Capital and legal registration**: Mobilize initial member equity and file formal registration with the cooperative authority/ministry.\n` +
            `> 6. **Operational launch**: Inaugurate the elected board and commence collective purchasing or aggregated sales.`;
    }

    if (/\b(soil\s*test|soil\s*sampl)/i.test(q)) {
        return `> **Field advisory protocol (standard soil sampling procedure):**\n` +
            `> 1. **Field zoning**: Divide land into uniform sampling units based on topography and cropping history.\n` +
            `> 2. **Zig-zag core collection**: Take 10–20 core subsamples at 15–20 cm depth using a clean auger or spade.\n` +
            `> 3. **Composite mixing**: Combine cores in a clean plastic bucket and mix thoroughly.\n` +
            `> 4. **Shade drying and labeling**: Air-dry ~500g of composite sample away from direct sun and chemical contamination.\n` +
            `> 5. **Laboratory submission**: Submit sample with crop history and GPS coordinates for nutrient analysis.`;
    }

    if (/\b(spray|pesticide|insecticide|fungicide|chemical application)\b/i.test(q)) {
        return `> **Field advisory protocol (safe chemical application and IPM):**\n` +
            `> 1. **Scouting and threshold verification**: Confirm pest density exceeds the economic injury level (EIL) before spraying.\n` +
            `> 2. **PPE inspection**: Wear complete personal protective equipment (gloves, mask, goggles, boots, overalls).\n` +
            `> 3. **Equipment calibration**: Calibrate nozzle flow rate and pressure with clean water to ensure uniform coverage.\n` +
            `> 4. **Environmental conditions**: Spray during cool morning/evening hours; never spray into headwind or before rainfall.\n` +
            `> 5. **Pre-harvest interval (PHI) and disposal**: Strictly observe the PHI before harvest and triple-rinse empty containers.`;
    }

    return null;
}

export function resolveChunkTitle(result: SearchResult, idx: number): string {
    const rawTitle = typeof result.metadata?.title === 'string' && result.metadata.title
        ? result.metadata.title
        : `Source ${idx + 1}`;
    return convertAllCapsLine(rawTitle);
}

export function collectInsightForParagraph(trimmed: string, resultId: string | undefined, keyBulletPoints: string[]): void {
    if (keyBulletPoints.length >= 8) return;
    const insight = parseInsightFromLine(trimmed);
    if (!insight) return;
    if (keyBulletPoints.includes(insight)) return;
    if (resultId?.startsWith('web-') && !isAgronomicContent(insight)) return;
    keyBulletPoints.push(insight);
}

export function processChunkParagraph(
    paragraph: string,
    resultId: string | undefined,
    seenParagraphs: Set<string>,
    cleanSourceParagraphs: string[],
    keyBulletPoints: string[]
): void {
    const trimmed = paragraph.trim();
    if (trimmed.length < 30) return;
    const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 100);
    if (seenParagraphs.has(norm)) return;
    seenParagraphs.add(norm);
    cleanSourceParagraphs.push(trimmed.replace(/^#{1,6}\s+/, '').trim());
    collectInsightForParagraph(trimmed, resultId, keyBulletPoints);
}

export function extractInsightsFromChunk(
    result: SearchResult,
    idx: number,
    seenParagraphs: Set<string>,
    keyBulletPoints: string[],
    structuredExcerpts: string[]
): void {
    const sanitized = sanitizeContextText(result.content);
    const title = resolveChunkTitle(result, idx);
    const cleanSourceParagraphs: string[] = [];

    for (const p of sanitized.split(/\n\n+/)) {
        processChunkParagraph(p, result.id, seenParagraphs, cleanSourceParagraphs, keyBulletPoints);
    }

    if (cleanSourceParagraphs.length > 0) {
        const formatted = cleanSourceParagraphs.slice(0, 3).join('\n\n');
        structuredExcerpts.push(`#### ${idx + 1}. ${title}\n${formatted}`);
    }
}

export function filterAgronomicResults(contextResults: SearchResult[]): SearchResult[] {
    return contextResults.filter(r => {
        if (!r.id?.startsWith('web-')) return true;
        return isAgronomicContent(`${r.metadata?.title || ''} ${r.content}`);
    });
}

export function buildEmptyExtractiveAnswer(queryText: string): ReasoningResult & { cached: boolean; contextUsed: SearchResult[] } {
    return {
        reasoning: 'No verified agricultural context found in knowledge base and AI provider did not complete in time.',
        answer: `I wasn't able to find verified agronomic information about **"${queryText}"** in the knowledge base. Please try rephrasing your question with specific crop, soil, pest, or farm management terms.`,
        confidence: 0.1,
        visuals: {
            kpis: [
                { label: 'Source Matches', value: '0', status: 'warning' as const },
                { label: 'Status', value: 'No Agricultural Match', status: 'warning' as const }
            ],
            charts: [],
            images: [],
            videos: []
        },
        contextUsed: [],
        cached: false
    };
}

export function resolvePrimarySource(primary: SearchResult): { sourceTitle: string; sourceUrl: string } {
    const rawTitle = typeof primary.metadata?.title === 'string' && primary.metadata.title
        ? primary.metadata.title
        : `${(primary.metadata?.crop as string) || 'Agricultural'} ${(primary.metadata?.category as string) || 'Knowledge'}`;
    return {
        sourceTitle: convertAllCapsLine(rawTitle),
        sourceUrl: primary.metadata?.sourceUrl ? ` (${primary.metadata.sourceUrl})` : ''
    };
}

export function collectChunkInsights(validResults: SearchResult[]): { keyBulletPoints: string[]; structuredExcerpts: string[] } {
    const seenParagraphs = new Set<string>();
    const keyBulletPoints: string[] = [];
    const structuredExcerpts: string[] = [];
    for (const [idx, result] of validResults.slice(0, 4).entries()) {
        extractInsightsFromChunk(result, idx, seenParagraphs, keyBulletPoints, structuredExcerpts);
    }
    return { keyBulletPoints, structuredExcerpts };
}

export function appendInsightSections(sections: string[], keyBulletPoints: string[], structuredExcerpts: string[]): void {
    if (keyBulletPoints.length > 0) {
        sections.push(`### Key identified insights and takeaways\n\n${keyBulletPoints.join('\n\n')}`);
    }
    if (structuredExcerpts.length > 0) {
        sections.push(`### Verified context and field reference\n\n${structuredExcerpts.join('\n\n')}`);
    }
}

export function appendSourceNote(sections: string[], validResults: SearchResult[]): void {
    const hasWebSources = validResults.some(r => r.id?.startsWith('web-'));
    sections.push(hasWebSources
        ? `*Note: The recommendations above are compiled from external agricultural research sources and should be verified with a local extension officer.*`
        : `*Note: The recommendations above are extracted directly from the local verified agricultural knowledge base.*`);
}

export function buildExtractiveSections(
    queryText: string,
    sourceTitle: string,
    sourceUrl: string,
    keyBulletPoints: string[],
    structuredExcerpts: string[],
    validResults: SearchResult[]
): string[] {
    const sections: string[] = [
        `I found source-backed guidance for: **"${queryText}"**.\n\n*Primary source reference: ${sourceTitle}${sourceUrl}*`,
    ];
    const proceduralNote = getProceduralGuidanceNote(queryText);
    if (proceduralNote) sections.push(proceduralNote);
    appendInsightSections(sections, keyBulletPoints, structuredExcerpts);
    appendSourceNote(sections, validResults);
    return sections;
}

export function buildExtractiveAnswer(queryText: string, contextResults: SearchResult[]): ReasoningResult & { cached: boolean; contextUsed: SearchResult[] } {
    const validResults = filterAgronomicResults(contextResults);

    if (validResults.length === 0) {
        return buildEmptyExtractiveAnswer(queryText);
    }

    const primary = validResults[0];
    const { sourceTitle, sourceUrl } = resolvePrimarySource(primary);
    const { keyBulletPoints, structuredExcerpts } = collectChunkInsights(validResults);
    const sections = buildExtractiveSections(queryText, sourceTitle, sourceUrl, keyBulletPoints, structuredExcerpts, validResults);
    const answer = normalizeAllCapsText(sections.join('\n\n---\n\n'));

    return {
        reasoning: 'Generated from retrieved knowledge-base context because the configured AI provider did not complete in time.',
        answer,
        confidence: Math.max(0.5, Math.min(primary.score || 0.7, 0.95)),
        visuals: {
            kpis: [
                { label: 'Source Matches', value: String(validResults.length), status: 'good' },
                { label: 'Top Match Score', value: (primary.score ?? 0).toFixed(2), status: (primary.score ?? 0) >= 0.65 ? 'good' : 'warning' }
            ],
            charts: [],
            images: [],
            videos: []
        },
        contextUsed: validResults,
        cached: false
    };
}
