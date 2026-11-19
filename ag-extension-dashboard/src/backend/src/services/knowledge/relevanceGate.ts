import type { SearchResult } from '@/services/vectorService';
import { retrievalSignals, type RetrievalSignals } from '@/services/vector/rrfFusion';
import { normalizeCrop } from './cropTerms';

/**
 * What makes a retrieved passage count as evidence, and how the farmer's
 * context reorders candidates. Pure functions, no I/O.
 *
 * Fusion always returns the top N articles, even for a question the knowledge
 * base cannot answer. Without a gate those N would be shown to the model as
 * "retrieved evidence" and the answer labelled as sourced.
 */

export interface RelevanceThresholds {
    minVectorSimilarity: number;
    minRerankScore: number;
}

export interface FarmContext {
    /** Crops the question is about; when empty, the farmer's crops. */
    crops?: string[];
    region?: string;
    country?: string;
}

/** Why a passage passed the gate, or why not. */
export function relevanceReason(signals: RetrievalSignals, thresholds: RelevanceThresholds):
    'reranker' | 'vector' | 'keyword' | 'rejected_by_reranker' | 'below_threshold' {
    if (signals.rerankScore !== undefined) {
        return signals.rerankScore >= thresholds.minRerankScore ? 'reranker' : 'rejected_by_reranker';
    }
    if ((signals.vectorSimilarity ?? -1) >= thresholds.minVectorSimilarity) return 'vector';
    if (signals.keywordMatch === 'all') return 'keyword';
    return 'below_threshold';
}

export function isRelevantEvidence(result: Pick<SearchResult, 'metadata'>, thresholds: RelevanceThresholds): boolean {
    const reason = relevanceReason(retrievalSignals(result), thresholds);
    return reason === 'reranker' || reason === 'vector' || reason === 'keyword';
}

function stringList(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    return typeof value === 'string' ? [value] : [];
}

const CROP_BOOST = 1.2;
const PLACE_BOOST = 1.1;

/** Multiplier for a candidate: articles about the farmer's crop and place rank a little higher. */
type Scored = { score: number; metadata: Record<string, unknown> };

export function contextBoost(result: Pick<Scored, 'metadata'>, context: FarmContext): number {
    let boost = 1;
    const wanted = new Set((context.crops ?? []).map(normalizeCrop));
    const articleCrops = [...stringList(result.metadata.crops), ...stringList(result.metadata.crop)].map(normalizeCrop);
    if (wanted.size > 0 && articleCrops.some(crop => wanted.has(crop))) boost *= CROP_BOOST;
    const places = [context.region, context.country].filter((place): place is string => Boolean(place)).map(place => place.toLowerCase());
    const articlePlaces = [...stringList(result.metadata.regions), ...stringList(result.metadata.country)].map(place => place.toLowerCase());
    if (places.some(place => articlePlaces.includes(place))) boost *= PLACE_BOOST;
    return boost;
}

/**
 * Reorder fused candidates by context. Boosts are small next to the gap
 * between a passage both search legs found and one only a single leg found,
 * so they break near-ties rather than overrule retrieval.
 */
export function applyContextBoosts<T extends Scored>(results: T[], context: FarmContext): T[] {
    return results
        .map((result, index) => {
            const boost = contextBoost(result, context);
            return {
                index,
                result: boost === 1 ? result : {
                    ...result,
                    score: result.score * boost,
                    metadata: { ...result.metadata, retrieval: { ...retrievalSignals(result), boost } satisfies RetrievalSignals },
                },
            };
        })
        .sort((a, b) => b.result.score - a.result.score || a.index - b.index)
        .map(({ result }) => result);
}

/** Passages more than this far below the best one are dropped as padding. */
const RERANK_MARGIN = 0.35;
const VECTOR_RATIO = 0.8;

/**
 * Evidence for the model: candidates that pass the absolute gate and are not
 * far below the best candidate. Five passages where one answers the question
 * and four merely clear the threshold invite the model to cite the four.
 */
export function selectEvidence<T extends Pick<SearchResult, 'metadata'>>(ranked: T[], thresholds: RelevanceThresholds, max: number): T[] {
    const passing = ranked.filter(result => isRelevantEvidence(result, thresholds));
    const signals = passing.map(retrievalSignals);
    const bestRerank = Math.max(...signals.map(signal => signal.rerankScore ?? -Infinity));
    const bestVector = Math.max(...signals.map(signal => signal.vectorSimilarity ?? -Infinity));
    return passing.filter((_, index) => {
        const signal = signals[index]!;
        if (signal.rerankScore !== undefined) return signal.rerankScore >= bestRerank - RERANK_MARGIN;
        if (signal.keywordMatch === 'all') return true;
        return (signal.vectorSimilarity ?? -Infinity) >= bestVector * VECTOR_RATIO;
    }).slice(0, max);
}
