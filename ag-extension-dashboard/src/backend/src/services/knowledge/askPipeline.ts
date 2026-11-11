import { AIRouter } from '@/services/aiProvider/aiProvider';
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import { VectorService, type SearchResult } from '@/services/vectorService';
import { createHash } from 'crypto';
import { cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { extractAgronomicIntakeContext, normalizeAgronomicQuery, isAgronomicContent } from '@/utils/agronomicQueryNormalizer';
import { checkExactCachesOnly } from '@/services/knowledge/cacheLookup';
import { enrichContextWithWebFallbacks } from '@/services/knowledge/webEnrichment';
import { resolveUserContext, type UserLocation } from '@/services/knowledge/userContext';
import { fetchLiveAgriContext } from '@/services/knowledge/liveAgriContext';
import { callReasoningAgentic } from '@/services/knowledge/reasoning';
import { buildExtractiveAnswer } from '@/services/knowledge/insightExtract';
import { splitQuarantined, quarantineDisclosure } from '@/services/knowledge/groundingPolicy';
import { postProcessResponse } from '@/services/knowledge/visuals';
import { logSearch } from '@/services/knowledge/searchLog';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';
import {
    buildAdvisoryEvidence,
    hasExplicitAdvisoryGeography,
    resolveAdvisoryCountry,
    resolveAdvisoryRegion,
    validateAdvisoryCitations,
} from './advisoryPolicy';
import type { AskOptions, FinalAnswer, KnowledgeAttachment, ReasonOptions } from '@/services/knowledge/types';
import { AdvisoryTimeoutError, withAdvisoryTimeout } from './advisoryRuntime';

/**
 * askQuestion pipeline: cache fast-path → parallel retrieval (categorize,
 * vector search, user context) → web + live enrichment → reasoning with
 * extractive fallback. Pure orchestration; domain logic lives in siblings.
 */

async function resolveAggregatedContext(
    queryText: string,
    queryCategories: string[],
    initialContextResults: SearchResult[],
    userContext: UserLocation
): Promise<{ contextResults: SearchResult[]; contextText: string }> {
    const isAgriQuery = queryCategories.length === 0 || isAgronomicContent(queryText) || queryCategories.some(c =>
        ['pest_and_disease', 'agronomy_and_yield', 'climate_and_weather', 'market_prices'].includes(c)
    );

    let contextResults = initialContextResults;
    try {
        contextResults = await withAdvisoryTimeout(
            () => enrichContextWithWebFallbacks(queryText, queryCategories, isAgriQuery, initialContextResults),
            12000, 'Knowledge web enrichment'
        );
    } catch (error) {
        logger.warn('Knowledge web enrichment unavailable; using retrieved evidence:', error);
    }

    if (isAgriQuery) {
        try {
            const liveResults = await withAdvisoryTimeout(
                () => fetchLiveAgriContext(queryCategories, userContext), 12000, 'Knowledge live context'
            );
            contextResults = [...liveResults, ...contextResults];
        } catch (error) {
            logger.warn('Knowledge live context unavailable; no live claims supplied:', error);
        }
    }

    // Quarantine: unverified scrapes never enter grounding text.
    const { groundable, withheld } = splitQuarantined(contextResults);
    contextResults = groundable;

    const evidence = buildAdvisoryEvidence(contextResults, userContext);
    contextResults = evidence.documents;
    const contextText = evidence.context + quarantineDisclosure(withheld);

    return { contextResults, contextText };
}

const HISTORY_WRITE_TIMEOUT_MS = 2000;

function logSearchWithTimeout(...args: Parameters<typeof logSearch>): void {
    let historyWrite: Promise<void>;
    try {
        historyWrite = Promise.resolve(logSearch(...args));
    } catch (error) {
        logger.error('Knowledge history persistence failed:', error);
        return;
    }

    const handledHistoryWrite = historyWrite.catch(error => {
        logger.error('Knowledge history persistence failed:', error);
    });
    void withAdvisoryTimeout(
        () => handledHistoryWrite,
        HISTORY_WRITE_TIMEOUT_MS,
        'Knowledge history persistence'
    ).catch(error => {
        if (error instanceof AdvisoryTimeoutError) {
            logger.warn('Knowledge history persistence timed out; returning answer without waiting for history:', error);
        } else {
            logger.error('Knowledge history persistence failed:', error);
        }
    });
}

async function cacheAndLogResponse(userId: string, queryText: string, attachments: KnowledgeAttachment[] | undefined, redisKey: string, queryCategories: string[], response: FinalAnswer): Promise<void> {
    const isAnswerValid = response.answer &&
        typeof response.answer === 'string' &&
        response.answer.length >= 200 &&
        !response.answer.includes('AI assistant is currently unavailable') &&
        !response.answer.includes('No context found in knowledge base');

    if (!attachments || attachments.length === 0) {
        if (isAnswerValid) {
            const ttl = queryCategories.some(category => ['market_prices', 'climate_and_weather'].includes(category)) ? 60 : 3600;
            cacheSet(redisKey, JSON.stringify(response), ttl).catch(e => logger.error('Failed to set Redis exact cache:', e));
        } else {
            logger.warn(`Skipping caching for low-quality or short answer (${response.answer?.length || 0} chars)`);
        }
    }

    logSearchWithTimeout(
        userId, queryText, queryCategories[0] || 'general_inquiry', undefined,
        response.answer, response.reasoning, response.visuals
    );
}

function handleAskQuestionFallback(queryText: string, contextResults: SearchResult[], error: unknown): FinalAnswer {
    logger.error('RAG analysis failed:', error);

    if (contextResults.length > 0) {
        const fallback = buildExtractiveAnswer(queryText, contextResults);
        return { ...fallback, answerMode: 'extractive' };
    }

    const noResultAnswer: FinalAnswer = {
        answerMode: 'unavailable',
        reasoning: 'No eligible context found in knowledge base and AI provider did not return an answer.',
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

    return noResultAnswer;
}

/** Post-process, attach context, cache-and-log, and return the final answer payload. */
async function finalizeAnswer(
    userId: string,
    queryText: string,
    redisKey: string,
    queryCategories: string[],
    contextResults: SearchResult[],
    reasoningResult: ReasoningResult,
    attachments: KnowledgeAttachment[] | undefined,
    options?: ReasonOptions
): Promise<FinalAnswer> {
    const evidence = buildAdvisoryEvidence(contextResults, options);
    if (typeof reasoningResult?.answer !== 'string' || !reasoningResult.answer.trim()) {
        throw new Error('Knowledge advisory provider returned no answer');
    }
    const guarded = agronomicSafetyGuard.guardAndEnrichAdvice(reasoningResult.answer, options?.language);
    const validated = validateAdvisoryCitations(guarded.text, evidence.citations, options?.language);
    const reasoningUnsafe = agronomicSafetyGuard.scanGeneratedAdvice(reasoningResult.reasoning || '').violations.length > 0;
    const visualsUnsafe = agronomicSafetyGuard.scanGeneratedAdvice(JSON.stringify(reasoningResult.visuals || {})).violations.length > 0;
    // Generate any audio from the guarded answer, never the original prescription.
    const safeReasoning = {
        ...reasoningResult,
        answer: validated.answer,
        reasoning: guarded.boundaryCheck.violations.length > 0 || reasoningUnsafe
            ? 'Treatment details withheld pending current local label or soil-test verification.'
            : reasoningResult.reasoning,
        toolCalls: undefined,
        audio: undefined,
        confidence: undefined,
        visuals: guarded.boundaryCheck.violations.length > 0 || visualsUnsafe ? undefined : reasoningResult.visuals,
    };
    const { visuals, audio } = await postProcessResponse(safeReasoning, queryText, options?.language);

    const response: FinalAnswer = {
        ...safeReasoning,
        answerMode: 'generated',
        visuals,
        audio,
        contextUsed: evidence.documents,
        advisoryQuality: validated.evidence,
        safety: guarded.boundaryCheck,
        cached: false
    };

    await cacheAndLogResponse(userId, queryText, attachments, redisKey, queryCategories, response);
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

async function lookupScopedAnswer(queryText: string, redisKey: string, attachments?: KnowledgeAttachment[], options?: AskOptions): Promise<FinalAnswer | null> {
    if (options?.bypassCache || attachments?.length) return null;
    try {
        return await withAdvisoryTimeout(
            () => checkExactCachesOnly(queryText, redisKey, true), 2000, 'Knowledge answer cache'
        );
    } catch (error) {
        logger.warn('Knowledge cache unavailable; generating a fresh answer:', error);
        return null;
    }
}

type AdvisoryLocation = Pick<UserLocation, 'country' | 'region' | 'location' | 'lat' | 'lng'>;
type IntakeContext = ReturnType<typeof extractAgronomicIntakeContext>['context'];

function extractIntakeCoordinates(zone?: string): { lat: number; lng: number } | undefined {
    const coordinates = zone?.match(
        /lat(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*,?\s*lng(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i
    );
    return coordinates ? { lat: Number(coordinates[1]), lng: Number(coordinates[2]) } : undefined;
}

function resolveAdvisoryScope(
    queryText: string,
    options: AskOptions | undefined,
    intakeContext: IntakeContext,
    profile: UserLocation
): { country?: string; region?: string; replaceProfileLocation: boolean } {
    const intakeCountry = intakeContext.locationZone
        ? resolveAdvisoryCountry(intakeContext.locationZone) : undefined;
    const explicitCountry = resolveAdvisoryCountry(queryText) || intakeCountry;
    const explicitRegion = resolveAdvisoryRegion(queryText);
    const hasExplicitGeography = hasExplicitAdvisoryGeography(queryText) || Boolean(intakeContext.locationZone);
    const country = explicitCountry ||
        (hasExplicitGeography ? undefined : resolveAdvisoryCountry('', options?.country || profile.country));
    return {
        country,
        region: explicitRegion || options?.region,
        replaceProfileLocation: Boolean(options?.country || options?.region) ||
            hasExplicitGeography || country !== profile.country,
    };
}

function resolveIntakeLocation(
    queryText: string,
    options: AskOptions | undefined,
    intakeContext: IntakeContext
): AdvisoryLocation {
    const zone = intakeContext.locationZone;
    const coordinates = extractIntakeCoordinates(zone);
    const intakeCountry = zone ? resolveAdvisoryCountry(zone) : undefined;
    const isClimateBand = Boolean(zone && /\bzone\s*\d|^tropical\b/i.test(zone));
    const intakeLocationIsCountry = Boolean(intakeCountry && zone?.trim().toLowerCase() === intakeCountry.toLowerCase());
    const region = resolveAdvisoryRegion(queryText) || options?.region;
    const location = region ? undefined : options?.region ||
        (zone && !isClimateBand && !intakeLocationIsCountry && !coordinates ? zone : undefined);
    return {
        region,
        location,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
    };
}

function resolveLocationContext(
    queryText: string,
    options: AskOptions | undefined,
    intakeContext: IntakeContext,
    profile: UserLocation
): AdvisoryLocation {
    const scope = resolveAdvisoryScope(queryText, options, intakeContext, profile);
    const intakeLocation = resolveIntakeLocation(queryText, options, intakeContext);
    return {
        country: scope.country,
        region: scope.region || (scope.replaceProfileLocation ? undefined : profile.region),
        location: scope.replaceProfileLocation ? intakeLocation.location : profile.location,
        lat: scope.replaceProfileLocation ? intakeLocation.lat : profile.lat,
        lng: scope.replaceProfileLocation ? intakeLocation.lng : profile.lng,
    };
}

async function resolveUserContextSafely(userId: string, queryText: string): Promise<UserLocation> {
    try {
        return await withAdvisoryTimeout(
            () => resolveUserContext(userId, queryText), 5000, 'Knowledge user context'
        );
    } catch (error) {
        logger.warn('Knowledge user context unavailable; proceeding without profile location:', error);
        return { crop: undefined };
    }
}

async function fetchInitialContext(
    queryText: string,
    options?: AskOptions
): Promise<{ queryCategories: string[]; results: SearchResult[] }> {
    const [queryCategories, results] = await Promise.all([
        categorizeQuery(queryText, options),
        withAdvisoryTimeout(
            () => VectorService.hybridSearch(queryText, 3, {}),
            8000, 'Knowledge vector retrieval'
        ).catch(error => {
            logger.warn('Knowledge vector retrieval unavailable; continuing without local evidence:', error);
            return [] as SearchResult[];
        }),
    ]);
    return { queryCategories, results };
}

function buildFallbackResponse(
    userId: string,
    queryText: string,
    queryCategories: string[],
    fallback: FinalAnswer,
    reasonOptions: ReasonOptions
): FinalAnswer {
    const guarded = agronomicSafetyGuard.guardAndEnrichAdvice(fallback.answer, reasonOptions.language);
    const validated = validateAdvisoryCitations(
        guarded.text,
        buildAdvisoryEvidence(fallback.contextUsed, reasonOptions).citations,
        reasonOptions.language
    );
    const reasoningUnsafe = agronomicSafetyGuard.scanGeneratedAdvice(fallback.reasoning || '').violations.length > 0;
    const visualsUnsafe = agronomicSafetyGuard.scanGeneratedAdvice(JSON.stringify(fallback.visuals || {})).violations.length > 0;
    const response: FinalAnswer = {
        ...fallback,
        answer: validated.answer,
        confidence: undefined,
        reasoning: guarded.boundaryCheck.violations.length > 0 || reasoningUnsafe
            ? 'Treatment details withheld pending current local label or soil-test verification.'
            : fallback.reasoning,
        audio: undefined,
        toolCalls: undefined,
        visuals: guarded.boundaryCheck.violations.length > 0 || visualsUnsafe ? undefined : fallback.visuals,
        advisoryQuality: validated.evidence,
        safety: guarded.boundaryCheck,
    };
    if (response.answerMode !== 'unavailable') {
        logSearchWithTimeout(userId, queryText, queryCategories[0], undefined, response.answer, response.reasoning, response.visuals);
    }
    return response;
}

export async function runAskQuestion(
    userId: string,
    queryText: string,
    attachments?: KnowledgeAttachment[],
    options?: AskOptions
): Promise<FinalAnswer> {
    const extractedQuery = extractAgronomicIntakeContext(queryText);
    const cleanQueryText = normalizeAgronomicQuery(extractedQuery.query);
    logger.info(`Getting RAG-based answer for query: "${queryText}" (normalized: "${cleanQueryText}", User: ${userId}, Attachments: ${attachments?.length || 0}, PreferredProvider: ${options?.preferredProvider || 'default'}, BypassCache: ${Boolean(options?.bypassCache)})`);

    const userContext = await resolveUserContextSafely(userId, cleanQueryText);
    const locationContext = resolveLocationContext(cleanQueryText, options, extractedQuery.context, userContext);
    Object.assign(userContext, locationContext);
    const reasonOptions: ReasonOptions = { ...options, ...extractedQuery.context, ...locationContext };
    const scope = createHash('sha256').update(JSON.stringify({
        userId, query: cleanQueryText, country: userContext.country,
        region: reasonOptions.region, language: options?.language,
        provider: options?.preferredProvider, day: new Date().toISOString().slice(0, 10),
        allowTools: options?.allowTools,
        locationZone: reasonOptions.locationZone, soil: reasonOptions.soil,
        water: reasonOptions.water, goal: reasonOptions.goal,
    })).digest('hex');
    const baseRedisKey = `rag:advisory-v6:${scope}`;

    // Only reuse this user's context-scoped, policy-versioned answer cache.
    const exactHit = await lookupScopedAnswer(cleanQueryText, baseRedisKey, attachments, options);
    if (exactHit) {
        logger.info(`Exact cache HIT (pre-categorization) for query: "${cleanQueryText}"`);
        logSearchWithTimeout(userId, cleanQueryText, undefined, undefined, exactHit.answer, exactHit.reasoning, exactHit.visuals);
        return exactHit;
    }

    // Parallelize categorization and retrieval after resolving location scope.
    const { queryCategories, results: initialContextResults } =
        await fetchInitialContext(cleanQueryText, options);

    const redisKey = baseRedisKey;

    const { contextResults, contextText } = await resolveAggregatedContext(
        cleanQueryText,
        queryCategories,
        initialContextResults,
        userContext
    );

    try {
        const reasoningResult = await callReasoningAgentic(contextText, cleanQueryText, attachments, reasonOptions, queryCategories);
        return await finalizeAnswer(userId, cleanQueryText, redisKey, queryCategories, contextResults, reasoningResult, attachments, reasonOptions);
    } catch (error) {
        const fallback = handleAskQuestionFallback(cleanQueryText, contextResults, error);
        return buildFallbackResponse(userId, cleanQueryText, queryCategories, fallback, reasonOptions);
    }
}
