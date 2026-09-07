/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReasoningResult } from '@/services/aiProvider/aiProvider';
import { VectorService, SearchResult } from '@/services/vectorService';
import { normalizeAgronomicQuery } from '@/utils/agronomicQueryNormalizer';
import {
    getSearchHistory as fetchSearchHistory,
    getSearchStats as fetchSearchStats,
    logSearch as persistSearch,
} from '@/services/knowledge/searchLog';
import { categorizeQuery as runCategorizeQuery, runAskQuestion } from '@/services/knowledge/askPipeline';
import { validateAndEnhanceVisuals as enhanceVisuals } from '@/services/knowledge/visuals';
import type { AskOptions, KnowledgeAttachment, ReasonOptions } from '@/services/knowledge/types';

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
        visuals?: Record<string, any>
    ): Promise<void> {
        return persistSearch(userId, queryText, category, crop, answer, reasoning, visuals);
    }

    /**
     * Get recent search history for a user (de-duplicated)
     */
    static async getSearchHistory(userId: string, limit: number = 10): Promise<Record<string, any>[]> {
        return fetchSearchHistory(userId, limit);
    }

    /**
     * Get knowledge search statistics for visuals
     * Cached in Redis for 5 minutes to avoid repeated expensive queries
     */
    static async getSearchStats(): Promise<Record<string, any>> {
        return fetchSearchStats();
    }

    static async askQuestion(
        userId: string,
        queryText: string,
        attachments?: KnowledgeAttachment[],
        options?: AskOptions
    ): Promise<ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }> {
        return runAskQuestion(userId, queryText, attachments, options);
    }

    /**
     * Categorize a query to optimize retrieval
     * Wrapped in a 10-second timeout so a slow AI provider doesn't block the RAG pipeline.
     */
    static async categorizeQuery(queryText: string, options?: ReasonOptions): Promise<string[]> {
        return runCategorizeQuery(queryText, options);
    }

    /**
     * Validates and enhances visual assets with runtime checks
     */
    static async validateAndEnhanceVisuals(visuals: Record<string, any>, searchQuery: string): Promise<Record<string, any>> {
        return enhanceVisuals(visuals, searchQuery);
    }
}
