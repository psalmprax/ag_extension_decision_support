import type { SearchResult } from '@/services/vectorService';

/**
 * Reciprocal Rank Fusion (RRF) merge for hybrid (vector + keyword) results.
 * Pure functions — no I/O.
 */

export function addToRrfMap(
    rrfMap: Map<string, { doc: SearchResult; score: number }>,
    results: SearchResult[],
    k: number,
    defaultScore: number = 0
): void {
    results.forEach((doc, idx) => {
        const rank = idx + 1;
        const rrfWeight = 1 / (k + rank);
        const existing = rrfMap.get(doc.id);
        if (existing) {
            existing.score += rrfWeight;
        } else {
            rrfMap.set(doc.id, {
                doc,
                score: rrfWeight + defaultScore
            });
        }
    });
}

export function mergeAndSortRrfResults(
    rrfMap: Map<string, { doc: SearchResult; score: number }>,
    limit: number
): SearchResult[] {
    return Array.from(rrfMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => {
            item.doc.score = item.score;
            return item.doc;
        });
}
