import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import type { SearchResult } from '@/services/vectorService';
import type { RetrievalSignals } from '@/services/vector/rrfFusion';
import { articleSearchVector } from '@/services/vector/vectorSql';

/**
 * PostgreSQL full-text (tsquery) keyword search with ILIKE fallback.
 * Tries AND conjunction first for precision, then OR for recall,
 * then a stop-word-tolerant ILIKE scan. Each hit records which of the three
 * matched (`metadata.retrieval.keywordMatch`), since an AND match is strong
 * evidence of relevance and a substring match is not.
 */

const STOP_WORDS = new Set([
    'what', 'are', 'the', 'is', 'for', 'and', 'face', 'can', 'how', 'why', 'who',
    'does', 'did', 'with', 'from', 'into', 'about', 'tell', 'give', 'some', 'any',
    'this', 'that', 'these', 'those', 'which', 'when', 'where'
]);

type KeywordRow = {
    id: string;
    content: string;
    title: unknown;
    category: unknown;
    crops: unknown[] | null;
    tags: unknown;
    regions: unknown;
    updated_at: unknown;
    source: unknown;
    source_url: unknown;
    content_type: unknown;
    score: unknown;
};

export type KeywordFilters = { category?: string; crop?: string };

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
export function extractKeywordTerms(normalizedQuery: string): string[] {
    return normalizedQuery
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word.toLowerCase()));
}

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
export function applyKeywordFilters(
    params: Array<string | number>,
    where: string[],
    filters: KeywordFilters
): void {
    if (filters.category) {
        params.push(filters.category);
        where.push(`category = $${params.length}`);
    }
    if (filters.crop) {
        params.push(filters.crop);
        where.push(`$${params.length} = ANY(crops)`);
    }
}

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
export function mapKeywordRows(rows: unknown[], keywordMatch?: RetrievalSignals['keywordMatch']): SearchResult[] {
    return (rows as KeywordRow[]).map((row) => ({
        id: row.id,
        content: row.content,
        metadata: {
            title: row.title,
            category: row.category,
            crop: Array.isArray(row.crops) ? row.crops[0] : undefined,
            crops: Array.isArray(row.crops) ? row.crops : [],
            source: row.source,
            sourceUrl: row.source_url,
            tags: row.tags,
            regions: row.regions,
            updatedAt: row.updated_at,
            contentType: (row.content_type as string) || 'text',
            ...(keywordMatch ? { retrieval: { keywordMatch } satisfies RetrievalSignals } : {})
        },
        score: Number.parseFloat(String(row.score ?? 0))
    }));
}

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
export async function searchByTsQuery(
    tsQuery: string,
    limit: number,
    filters: KeywordFilters,
    keywordMatch: 'all' | 'any' = tsQuery.includes('|') ? 'any' : 'all'
): Promise<SearchResult[]> {
    const params: Array<string | number> = [tsQuery];
    const where: string[] = [`${articleSearchVector()} @@ to_tsquery('english', $1)`];
    applyKeywordFilters(params, where, filters);
    params.push(limit);
    const result = await query(`
        SELECT id, title, content, category, crops, tags, regions, updated_at, source, source_url, content_type,
               ts_rank_cd(${articleSearchVector()}, to_tsquery('english', $1), 32) as score
        FROM knowledge_articles
        WHERE ${where.join(' AND ')}
        ORDER BY score DESC
        LIMIT $${params.length}
    `, params as unknown as unknown[]);
    return mapKeywordRows(result.rows as unknown[], keywordMatch);
}

export async function executeIlikeFallback(
    queryText: string,
    limit: number,
    filters: KeywordFilters
): Promise<SearchResult[]> {
    const trimmed = queryText.trim();
    if (!trimmed) return [];

    // Extract key terms (skip stop words and short tokens)
    const meaningfulWords = extractKeywordTerms(trimmed);

    const params: Array<string | number> = [];
    const conditions: string[] = [];

    if (meaningfulWords.length > 0) {
        const wordClauses = meaningfulWords.map(w => {
            params.push(`%${w}%`);
            const idx = params.length;
            return `(title ILIKE $${idx} OR content ILIKE $${idx})`;
        });
        conditions.push(`(${wordClauses.join(' OR ')})`);
    } else {
        params.push(`%${trimmed}%`);
        conditions.push(`(title ILIKE $1 OR content ILIKE $1)`);
    }

    if (filters.category) {
        params.push(filters.category);
        conditions.push(`category = $${params.length}`);
    }
    if (filters.crop) {
        params.push(filters.crop);
        conditions.push(`$${params.length} = ANY(crops)`);
    }
    params.push(limit);

    const ilikeResult = await query(`
        SELECT id, title, content, category, crops, tags, regions, updated_at, source, source_url, content_type, 0.6 as score
        FROM knowledge_articles
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}
    `, params as unknown as unknown[]);

    return mapKeywordRows(ilikeResult.rows, 'substring');
}

/** Search for knowledge articles using PostgreSQL full-text search (keyword-based). */
export async function keywordSearch(
    queryText: string,
    limit: number = 5,
    filters: KeywordFilters = {}
): Promise<SearchResult[]> {
    const normalizedQuery = normalizeAgronomicQuery(queryText);
    logger.info(`Searching database via keyword search for: "${queryText}" (normalized: "${normalizedQuery}")`);
    try {
        const words = extractKeywordTerms(normalizedQuery);
        if (words.length === 0) {
            return await executeIlikeFallback(normalizedQuery, limit, filters);
        }

        const andResults = await searchByTsQuery(words.join(' & '), limit, filters, 'all');
        if (andResults.length >= limit) return andResults;

        if (words.length === 1) {
            return andResults.length > 0 ? andResults : await executeIlikeFallback(normalizedQuery, limit, filters);
        }

        // Full matches first, then partial matches fill the remaining places.
        const orResults = await searchByTsQuery(words.join(' | '), limit, filters, 'any');
        const fullMatchIds = new Set(andResults.map(result => result.id));
        const combined = [...andResults, ...orResults.filter(result => !fullMatchIds.has(result.id))].slice(0, limit);
        if (combined.length > 0) return combined;

        return await executeIlikeFallback(normalizedQuery, limit, filters);
    } catch (error) {
        logger.error('Database keyword search failed:', error);
        return [];
    }
}
