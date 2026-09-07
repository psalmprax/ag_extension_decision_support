import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import type { SearchResult } from '@/services/vectorService';

/**
 * PostgreSQL full-text (tsquery) keyword search with ILIKE fallback.
 * Tries AND conjunction first for precision, then OR for recall,
 * then a stop-word-tolerant ILIKE scan.
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
    source_url: unknown;
    content_type: unknown;
    score: unknown;
};

export type KeywordFilters = { category?: string; crop?: string };

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
export function extractKeywordTerms(normalizedQuery: string): string[] {
    return normalizedQuery
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word.toLowerCase()));
}

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
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
// fallow-ignore-next-line unused-export
export function mapKeywordRows(rows: unknown[]): SearchResult[] {
    return (rows as KeywordRow[]).map((row) => ({
        id: row.id,
        content: row.content,
        metadata: {
            title: row.title,
            category: row.category,
            crop: Array.isArray(row.crops) ? row.crops[0] : undefined,
            sourceUrl: row.source_url,
            contentType: (row.content_type as string) || 'text'
        },
        score: Number.parseFloat(String(row.score ?? 0))
    }));
}

// Directly unit-tested in vectorHelpers.test.ts (test files are not entry points).
// fallow-ignore-next-line unused-export
export async function searchByTsQuery(
    tsQuery: string,
    limit: number,
    filters: KeywordFilters
): Promise<SearchResult[]> {
    const params: Array<string | number> = [tsQuery];
    const where: string[] = ["to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', $1)"];
    applyKeywordFilters(params, where, filters);
    params.push(limit);
    const result = await query(`
        SELECT id, title, content, category, crops, source_url, content_type,
               ts_rank_cd(to_tsvector('english', title || ' ' || content), to_tsquery('english', $1)) as score
        FROM knowledge_articles
        WHERE ${where.join(' AND ')}
        ORDER BY score DESC
        LIMIT $${params.length}
    `, params as unknown as unknown[]);
    return mapKeywordRows(result.rows as unknown[]);
}

export async function executeIlikeFallback(
    queryText: string,
    limit: number,
    filters: KeywordFilters
): Promise<SearchResult[]> {
    const trimmed = queryText.trim();
    if (!trimmed) return [];

    // Extract key terms (skip stop words and short tokens)
    const meaningfulWords = trimmed
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

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
        SELECT id, title, content, category, crops, source_url, content_type, 0.6 as score
        FROM knowledge_articles
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}
    `, params as unknown as unknown[]);

    return (ilikeResult.rows as unknown as KeywordRow[]).map((row) => ({
        id: row.id,
        content: row.content,
        metadata: {
            title: row.title,
            category: row.category,
            crop: Array.isArray(row.crops) ? row.crops[0] : undefined,
            sourceUrl: row.source_url,
            contentType: (row.content_type as string) || 'text'
        },
        score: 0.6
    }));
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

        const andResults = await searchByTsQuery(words.join(' & '), limit, filters);
        if (andResults.length > 0) return andResults;

        if (words.length === 1) {
            return await executeIlikeFallback(normalizedQuery, limit, filters);
        }

        const orResults = await searchByTsQuery(words.join(' | '), limit, filters);
        if (orResults.length > 0) return orResults;

        return await executeIlikeFallback(normalizedQuery, limit, filters);
    } catch (error) {
        logger.error('Database keyword search failed:', error);
        return [];
    }
}
