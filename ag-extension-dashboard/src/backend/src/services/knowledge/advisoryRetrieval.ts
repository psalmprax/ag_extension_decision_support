import { RAGV2Service } from '@/services/ragV2Service';
import { VectorService } from '@/services/vectorService';
import { logger } from '@/utils/logger';
import { buildAdvisoryEvidence, type AdvisoryContext } from './advisoryPolicy';
import { withAdvisoryTimeout } from './advisoryRuntime';

export async function retrieveAdvisoryEvidence(question: string, context: AdvisoryContext = {}) {
    const retrievalQuery = context.country ? `${question}\nCountry: ${context.country}` : question;
    try {
        const result = await withAdvisoryTimeout(() => RAGV2Service.enhancedSearch(retrievalQuery, {
            limit: 5, useChunks: true, useGraph: true, useReranking: true,
        }), 8000, 'Advisory retrieval');
        const evidence = buildAdvisoryEvidence(result.results.map(document => ({
            id: document.articleId || document.id,
            content: document.content,
            metadata: document.metadata,
            score: document.score,
        })), context);
        if (evidence.documents.length > 0) return evidence;
        const fallback = await withAdvisoryTimeout(
            () => VectorService.hybridSearch(retrievalQuery, 5), 4000, 'Advisory fallback retrieval'
        );
        return buildAdvisoryEvidence(fallback, context);
    } catch (error) {
        logger.warn('Advisory retrieval unavailable; returning explicitly ungrounded guidance:', error);
        return buildAdvisoryEvidence([], context);
    }
}
