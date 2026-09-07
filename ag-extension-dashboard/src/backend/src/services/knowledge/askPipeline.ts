import { AIRouter } from '@/services/aiProvider/aiProvider';
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import { VectorService, SearchResult } from '@/services/vectorService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { normalizeAgronomicQuery, isAgronomicContent } from '@/utils/agronomicQueryNormalizer';
import { checkAnswerCaches, checkExactCachesOnly } from '@/services/knowledge/cacheLookup';
import { enrichContextWithWebFallbacks } from '@/services/knowledge/webEnrichment';
import { resolveUserContext, UserLocation } from '@/services/knowledge/userContext';
import { fetchLiveAgriContext } from '@/services/knowledge/liveAgriContext';
import { callReasoningAgentic, callReasoningWithTimeout } from '@/services/knowledge/reasoning';
import { buildExtractiveAnswer } from '@/services/knowledge/insightExtract';
import { postProcessResponse } from '@/services/knowledge/visuals';
import { logSearch } from '@/services/knowledge/searchLog';
import type { AskOptions, FinalAnswer, KnowledgeAttachment, ReasonOptions } from '@/services/knowledge/types';

/**
 * askQuestion pipeline: cache fast-path → parallel retrieval (categorize,
 * vector search, user context) → web + live enrichment → reasoning with
 * extractive fallback. Pure orchestration; domain logic lives in siblings.
 */

export async function resolveAggregatedContext(
    queryText: string,
    queryCategories: string[],
    initialContextResults: SearchResult[],
    userContext: UserLocation
): Promise<{ contextResults: SearchResult[]; contextText: string }> {
    const isAgriQuery = queryCategories.length === 0 || isAgronomicContent(queryText) || queryCategories.some(c =>
        ['pest_and_disease', 'agronomy_and_yield', 'climate_and_weather', 'market_prices'].includes(c)
    );

    let contextResults = await enrichContextWithWebFallbacks(queryText, queryCategories, isAgriQuery, initialContextResults);

    if (isAgriQuery) {
        const liveResults = await fetchLiveAgriContext(queryCategories, userContext);
        contextResults = [...liveResults, ...contextResults];
    }

    const contextText = contextResults
        .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}] (Type: ${res.metadata.contentType || 'text'}, Score: ${res.score !== undefined ? res.score.toFixed(2) : '1.0'}, URL: ${res.metadata.sourceUrl || ''})\n${res.content}`)
        .join('\n\n---\n\n');

    return { contextResults, contextText };
}

export function cacheAndLogResponse(userId: string, queryText: string, attachments: KnowledgeAttachment[] | undefined, redisKey: string, queryCategories: string[], response: FinalAnswer): void {
    const isAnswerValid = response.answer &&
        typeof response.answer === 'string' &&
        response.answer.length >= 200 &&
        !response.answer.includes('AI assistant is currently unavailable') &&
        !response.answer.includes('No context found in knowledge base');

    if (!attachments || attachments.length === 0) {
        if (isAnswerValid) {
            cacheSet(redisKey, JSON.stringify(response), 3600 * 24).catch(e => logger.error('Failed to set Redis exact cache:', e));
            SemanticCacheService.save(queryText, response.answer, response.contextUsed, response.visuals).catch(e => logger.error('Failed to save semantic cache:', e));
        } else {
            logger.warn(`Skipping caching for low-quality or short answer (${response.answer?.length || 0} chars)`);
        }
    }

    logSearch(
        userId, queryText, queryCategories[0] || 'general_inquiry', undefined,
        response.answer, response.reasoning, response.visuals
    ).catch(logError => logger.error('Background logging failed:', logError));
}

export function handleAskQuestionFallback(userId: string, queryText: string, contextResults: SearchResult[], error: unknown): FinalAnswer {
    logger.error('RAG analysis failed:', error);

    if (contextResults.length > 0) {
        const fallback = buildExtractiveAnswer(queryText, contextResults);
        logSearch(
            userId, queryText,
            contextResults[0]?.metadata?.category as string | undefined, contextResults[0]?.metadata?.crop as string | undefined,
            fallback.answer, fallback.reasoning, fallback.visuals
        ).catch(logError => logger.error('Fallback search logging failed:', logError));
        return fallback;
    }

    const noResultAnswer: FinalAnswer = {
        reasoning: 'No context found in knowledge base and AI provider did not complete in time.',
        answer: `I wasn't able to find information about **"${queryText}"** in the knowledge base, and the AI assistant is currently unavailable. Please try rephrasing your question or check back later.`,
        confidence: 0.1,
        visuals: {
            kpis: [
                { label: 'Source Matches', value: '0', status: 'warning' as const },
                { label: 'Status', value: 'No Results', status: 'warning' as const }
            ],
            charts: [],
            images: [],
            videos: []
        },
        contextUsed: [],
        cached: false
    };

    logSearch(
        userId, queryText, 'general_inquiry', undefined,
        noResultAnswer.answer, noResultAnswer.reasoning, noResultAnswer.visuals
    ).catch(logError => logger.error('Fallback search logging failed:', logError));

    return noResultAnswer;
}

/** Post-process, attach context, cache-and-log, and return the final answer payload. */
export async function finalizeAnswer(
    userId: string,
    queryText: string,
    redisKey: string,
    queryCategories: string[],
    contextResults: SearchResult[],
    reasoningResult: ReasoningResult,
    attachments: KnowledgeAttachment[] | undefined
): Promise<FinalAnswer> {
    const { visuals, audio } = await postProcessResponse(reasoningResult, queryText);

    const response = {
        ...reasoningResult,
        visuals,
        audio,
        contextUsed: contextResults,
        cached: false
    };

    cacheAndLogResponse(userId, queryText, attachments, redisKey, queryCategories, response);
    return response;
}

/**
 * Categorize a query to optimize retrieval.
 * Wrapped in a 10-second timeout so a slow AI provider doesn't block the RAG pipeline.
 */
interface ClassificationLabel {
    score: number;
    label: string;
}

function isClassificationResult(value: unknown): value is { labels: ClassificationLabel[] } {
    if (typeof value !== 'object' || value === null) return false;
    const labels = (value as { labels?: unknown }).labels;
    return Array.isArray(labels);
}

export async function categorizeQuery(queryText: string, options?: ReasonOptions): Promise<string[]> {
    const TIMEOUT_MS = 10000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        const classification: unknown = await Promise.race([
            AIRouter.routeRequest('classify', {
                input: queryText,
                options: {
                    taxonomy: 'pest_and_disease, agronomy_and_yield, climate_and_weather, market_prices, general_inquiry',
                    multiLabel: true,
                    preferredProvider: options?.preferredProvider
                }
            }),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error(`categorizeQuery timed out after ${TIMEOUT_MS}ms`)),
                    TIMEOUT_MS
                );
            }),
        ]).finally(() => clearTimeout(timeoutId));

        if (!isClassificationResult(classification)) return ['general_inquiry'];
        return classification.labels
            .filter((l) => typeof l.score === 'number' && typeof l.label === 'string' && l.score > 0.4)
            .map((l) => l.label);
    } catch (error) {
        const isTimeout = (error as Error).message?.includes('categorizeQuery timed out');
        if (isTimeout) {
            logger.warn(`categorizeQuery timeout for: "${queryText.substring(0, 80)}" — falling back to general_inquiry`);
        } else {
            logger.error('categorizeQuery failed:', error);
        }
        return ['general_inquiry'];
    }
}

export async function runAskQuestion(
    userId: string,
    queryText: string,
    attachments?: KnowledgeAttachment[],
    options?: AskOptions
): Promise<FinalAnswer> {
    const cleanQueryText = normalizeAgronomicQuery(queryText);
    logger.info(`Getting RAG-based answer for query: "${queryText}" (normalized: "${cleanQueryText}", User: ${userId}, Attachments: ${attachments?.length || 0}, PreferredProvider: ${options?.preferredProvider || 'default'}, BypassCache: ${Boolean(options?.bypassCache)})`);

    const normalized = cleanQueryText.toLowerCase().trim();
    const baseRedisKey = `rag:exact:${normalized}`;

    // Fast-path: check exact match caches first (<2ms) before making AI classification or vector calls
    if (!options?.bypassCache && (!attachments || attachments.length === 0)) {
        const exactHit = await checkExactCachesOnly(cleanQueryText, baseRedisKey);
        if (exactHit) {
            logger.info(`Exact cache HIT (pre-categorization) for query: "${cleanQueryText}"`);
            return exactHit;
        }
    }

    // Parallelize query categorization, local vector search, and user/farmer context resolution
    const [queryCategories, initialContextResults, userContext] = await Promise.all([
        categorizeQuery(cleanQueryText, options),
        VectorService.hybridSearch(normalizeAgronomicQuery(cleanQueryText), 3, {}),
        resolveUserContext(userId, cleanQueryText),
    ]);

    const isRealTimeIntent = queryCategories.some(c => ['market_and_commodity_prices', 'climate_and_weather', 'market_prices'].includes(c));
    const freshSuffix = isRealTimeIntent ? `:fresh:${new Date().toISOString().slice(0, 10)}` : '';
    const redisKey = `rag:exact:${normalized}${freshSuffix}`;

    if (!options?.bypassCache) {
        const cachedHit = await checkAnswerCaches(cleanQueryText, redisKey, attachments, isRealTimeIntent);
        if (cachedHit) return cachedHit;
    }

    const { contextResults, contextText } = await resolveAggregatedContext(
        cleanQueryText,
        queryCategories,
        initialContextResults,
        userContext
    );

    try {
        const reasoningResult = process.env.KNOWLEDGE_AGENTIC_LOOP === 'false'
            ? await callReasoningWithTimeout(contextText, cleanQueryText, attachments, options)
            : await callReasoningAgentic(contextText, cleanQueryText, attachments, options, queryCategories);
        return await finalizeAnswer(userId, cleanQueryText, redisKey, queryCategories, contextResults, reasoningResult, attachments);
    } catch (error) {
        return handleAskQuestionFallback(userId, cleanQueryText, contextResults, error);
    }
}
