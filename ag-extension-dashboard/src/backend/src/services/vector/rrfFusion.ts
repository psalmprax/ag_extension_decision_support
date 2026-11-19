import type { SearchResult } from '@/services/vectorService';

/**
 * Reciprocal Rank Fusion (RRF) for hybrid retrieval. Pure functions, no I/O.
 *
 * Each ranked list ("leg") contributes weight / (k + rank) per document, so a
 * document both legs agree on always outranks one found by a single leg at the
 * same ranks. The per-leg evidence (cosine similarity, keyword match, ranks) is
 * kept on `metadata.retrieval`: the fused score only orders candidates, it says
 * nothing about whether any candidate is relevant (see relevanceGate.ts).
 */

export const RRF_K = 60;

export type RetrievalLeg = 'vector' | 'keyword' | 'chunk' | 'translated_vector';

export interface RetrievalSignals {
    /** Best cosine similarity from any vector leg (articles or chunks). */
    vectorSimilarity?: number;
    /** 'all': every query term matched; 'any': some terms; 'substring': ILIKE fallback. */
    keywordMatch?: 'all' | 'any' | 'substring';
    ranks?: Partial<Record<RetrievalLeg, number>>;
    fusedScore?: number;
    rerankScore?: number;
    rerankedBy?: 'cross_encoder' | 'llm';
    boost?: number;
}

const KEYWORD_STRENGTH = { substring: 1, any: 2, all: 3 } as const;

export function retrievalSignals(doc: Pick<SearchResult, 'metadata'>): RetrievalSignals {
    const value = doc.metadata?.retrieval;
    return value && typeof value === 'object' ? value as RetrievalSignals : {};
}

/** Merge two documents' signals, keeping the strongest evidence of each kind. */
export function mergeSignals(a: RetrievalSignals, b: RetrievalSignals): RetrievalSignals {
    const vectorSimilarity = Math.max(a.vectorSimilarity ?? -Infinity, b.vectorSimilarity ?? -Infinity);
    const keywordMatch = [a.keywordMatch, b.keywordMatch]
        .filter((match): match is NonNullable<RetrievalSignals['keywordMatch']> => match !== undefined)
        .sort((x, y) => KEYWORD_STRENGTH[y] - KEYWORD_STRENGTH[x])[0];
    return {
        ...a,
        ...b,
        vectorSimilarity: Number.isFinite(vectorSimilarity) ? vectorSimilarity : undefined,
        keywordMatch,
        ranks: { ...a.ranks, ...b.ranks },
    };
}

export interface RankedLeg {
    leg: RetrievalLeg;
    results: SearchResult[];
    weight?: number;
}

/**
 * Fuse ranked legs into one list. The first occurrence of a document supplies
 * its content unless a later leg's entry is preferred by `preferContentFrom`
 * (chunk hits carry the passage that matched rather than the whole article).
 */
export function fuseRankedLegs(
    legs: RankedLeg[],
    limit: number,
    options: { k?: number; preferContentFrom?: RetrievalLeg } = {}
): SearchResult[] {
    const k = options.k ?? RRF_K;
    const fused = new Map<string, { doc: SearchResult; score: number }>();
    for (const { leg, results, weight = 1 } of legs) {
        const seenInLeg = new Set<string>();
        results.forEach(doc => {
            if (seenInLeg.has(doc.id)) return;
            seenInLeg.add(doc.id);
            const rank = seenInLeg.size;
            const legSignals: RetrievalSignals = { ...retrievalSignals(doc), ranks: { [leg]: rank } };
            const contribution = weight / (k + rank);
            const existing = fused.get(doc.id);
            if (!existing) {
                fused.set(doc.id, {
                    doc: { ...doc, metadata: { ...doc.metadata, retrieval: legSignals } },
                    score: contribution,
                });
                return;
            }
            const signals = mergeSignals(retrievalSignals(existing.doc), legSignals);
            existing.doc = {
                ...(options.preferContentFrom === leg ? { ...existing.doc, content: doc.content } : existing.doc),
                metadata: { ...existing.doc.metadata, retrieval: signals },
            };
            existing.score += contribution;
        });
    }
    return [...fused.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ doc, score }) => ({
            ...doc,
            score,
            metadata: { ...doc.metadata, retrieval: { ...retrievalSignals(doc), fusedScore: score } },
        }));
}
