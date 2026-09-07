import { VectorService, SearchResult } from '@/services/vectorService';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import {
    getSearchHistory as fetchSearchHistory,
    getSearchStats as fetchSearchStats,
    logSearch as persistSearch,
} from '@/services/knowledge/searchLog';
import { categorizeQuery as runCategorizeQuery, runAskQuestion } from '@/services/knowledge/askPipeline';
import type { AskOptions, FinalAnswer, KnowledgeAttachment, ReasonOptions, SearchHistoryEntry, SearchStats } from '@/services/knowledge/types';

export { getKnowledgeEvidenceStatus } from './knowledge/evidence';
export type { KnowledgeEvidenceStatus, KnowledgeArticle } from './knowledge/evidence';

/**
 * Public facade for the knowledge (RAG) pipeline.
 * All domain logic lives in `services/knowledge/*`; this class only
 * preserves the historical static API used by routes and workers.
 */
export class KnowledgeService {
    /**
     * Search for knowledge articles using RAG (Vector Search)
     */
    static async searchKnowledge(queryText: string, limit: number = 3, filters: { category?: string; crop?: string } = {}): Promise<SearchResult[]> {
        const cleanQuery = normalizeAgronomicQuery(queryText);
        return VectorService.hybridSearch(cleanQuery, limit, filters);
    }

    /**
     * Log a new search query for analytics and history
     */
    static async logSearch(
        userId: string,
        queryText: string,
        category?: string,
        crop?: string,
        answer?: string,
        reasoning?: string,
        visuals?: unknown
    ): Promise<void> {
        return persistSearch(userId, queryText, category, crop, answer, reasoning, visuals);
    }

    /**
     * Get recent search history for a user (de-duplicated)
     */
    static async getSearchHistory(userId: string, limit: number = 10): Promise<SearchHistoryEntry[]> {
        return fetchSearchHistory(userId, limit);
    }

    /**
     * Get knowledge search statistics for visuals
     * Cached in Redis for 5 minutes to avoid repeated expensive queries
     */
    static async getSearchStats(): Promise<SearchStats> {
        return fetchSearchStats();
    }

    static async askQuestion(
        userId: string,
        queryText: string,
        attachments?: KnowledgeAttachment[],
        options?: AskOptions
    ): Promise<FinalAnswer> {
        return runAskQuestion(userId, queryText, attachments, options);
    }

    /**
     * Categorize a query to optimize retrieval
     * Wrapped in a 10-second timeout so a slow AI provider doesn't block the RAG pipeline.
     * Covered by knowledgeService.test.ts (test files are not fallow entry points).
     */
    // fallow-ignore-next-line unused-class-member
    static async categorizeQuery(queryText: string, options?: ReasonOptions): Promise<string[]> {
        return runCategorizeQuery(queryText, options);
    }
}
