import { config } from '@/config';
import { RAGV2Service, type RankedResult } from '@/services/ragV2Service';
import type { SearchResult } from '@/services/vectorService';
import { retrievalSignals } from '@/services/vector/rrfFusion';
import { logger } from '@/utils/logger';
import { buildAdvisoryEvidence, type AdvisoryContext } from './advisoryPolicy';
import { withAdvisoryTimeout } from './advisoryRuntime';
import { cropsMentioned } from './cropTerms';
import { englishSearchQuery } from './queryTranslation';
import { applyContextBoosts, relevanceReason, selectEvidence } from './relevanceGate';

/** Candidates fused before reranking, and passages that may reach the model. */
const CANDIDATES = 12;
const MAX_EVIDENCE = 5;
/** Latency budget, ms. Retrieval and reranking degrade independently. */
const TRANSLATION_BUDGET = 2500;
const RETRIEVAL_BUDGET = 4000;
const RERANK_BUDGET = 4000;

function asSearchResult(result: RankedResult): SearchResult {
    const signals = retrievalSignals(result);
    // Show the most meaningful relevance number: reranker, else cosine similarity.
    const score = signals.rerankScore ?? signals.vectorSimilarity ?? result.score;
    return { id: result.articleId || result.id, content: result.content, metadata: result.metadata, score };
}

async function rerankWithinBudget(searchText: string, candidates: RankedResult[]): Promise<RankedResult[]> {
    try {
        return await withAdvisoryTimeout(
            () => RAGV2Service.rerank(searchText, candidates, candidates.length), RERANK_BUDGET, 'Advisory reranking'
        );
    } catch (error) {
        logger.warn('Advisory reranking unavailable; keeping retrieval order:', error);
        return candidates;
    }
}

export interface RankedAdvisoryEvidence {
    /** Every reranked candidate, best first, with its retrieval signals. */
    ranked: SearchResult[];
    /** The candidates that passed the relevance gate (at most MAX_EVIDENCE). */
    relevant: SearchResult[];
    englishQuery?: string;
}

/**
 * Hybrid retrieval in the question's language and in English, small boosts for
 * the farmer's crop and place, reranking, and the relevance gate. Throws when
 * retrieval itself fails; reranking failures only cost the reranked order.
 * The retrieval evaluation (scripts/rag-eval.ts) measures exactly this function.
 */
export async function rankAdvisoryEvidence(question: string, context: AdvisoryContext = {}): Promise<RankedAdvisoryEvidence> {
    const englishQuery = await englishSearchQuery(question, context.language, TRANSLATION_BUDGET);
    const searchText = englishQuery ?? question;
    const questionCrops = cropsMentioned(`${question}\n${englishQuery ?? ''}`);

    const candidates = await withAdvisoryTimeout(
        () => RAGV2Service.retrieveCandidates(question, { limit: CANDIDATES, englishQuery }),
        RETRIEVAL_BUDGET, 'Advisory retrieval'
    );
    const boosted = applyContextBoosts(candidates, {
        crops: questionCrops.length > 0 ? questionCrops : context.crops,
        region: context.region,
        country: context.country,
    });
    const ranked = (await rerankWithinBudget(searchText, boosted)).map(asSearchResult);
    const thresholds = config.retrieval;
    const relevant = selectEvidence(ranked, thresholds, MAX_EVIDENCE);

    logger.info('Advisory retrieval', {
        translated: englishQuery !== undefined,
        candidates: candidates.length,
        relevant: relevant.length,
        reasons: ranked.map(result => relevanceReason(retrievalSignals(result), thresholds)),
    });
    return { ranked, relevant, englishQuery };
}

/**
 * Evidence for an advisory answer. A question the knowledge base cannot answer
 * gets no evidence, and the answer is labelled general guidance, rather than
 * being handed the five nearest unrelated articles.
 */
export async function retrieveAdvisoryEvidence(question: string, context: AdvisoryContext = {}) {
    try {
        const { relevant } = await rankAdvisoryEvidence(question, context);
        return buildAdvisoryEvidence(relevant, context);
    } catch (error) {
        logger.warn('Advisory retrieval unavailable; returning explicitly ungrounded guidance:', error);
        return buildAdvisoryEvidence([], context);
    }
}
