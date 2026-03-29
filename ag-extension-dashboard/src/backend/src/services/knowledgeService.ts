import { AIRouter } from '@/services/aiProvider/aiProvider';
import { VectorService, SearchResult } from '@/services/vectorService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export interface KnowledgeArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    crop: string;
    tags: string[];
}

export class KnowledgeService {
    /**
     * Search for knowledge articles using RAG (Vector Search)
     */
    static async searchKnowledge(queryText: string, limit: number = 3): Promise<SearchResult[]> {
        return VectorService.search(queryText, limit);
    }

    /**
     * Log a new search query for analytics and history
     */
    static async logSearch(userId: string, queryText: string, category?: string, crop?: string): Promise<void> {
        try {
            await query(`
                INSERT INTO knowledge_searches (user_id, query, category, crop, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [userId, queryText, category, crop]);
        } catch (error) {
            logger.error('Failed to log knowledge search:', error);
        }
    }

    /**
     * Get recent search history for a user
     */
    static async getSearchHistory(userId: string, limit: number = 10): Promise<any[]> {
        try {
            const result = await query(`
                SELECT id, query as "queryText", category, crop, created_at as "createdAt"
                FROM knowledge_searches
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `, [userId, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get search history:', error);
            return [];
        }
    }

    /**
     * Get knowledge search statistics for visuals
     */
    static async getSearchStats(): Promise<any> {
        try {
            const topCrops = await query(`
                SELECT crop, COUNT(*) as count 
                FROM knowledge_searches 
                WHERE crop IS NOT NULL 
                GROUP BY crop 
                ORDER BY count DESC 
                LIMIT 5
            `);
            const topCategories = await query(`
                SELECT category, COUNT(*) as count 
                FROM knowledge_searches 
                WHERE category IS NOT NULL 
                GROUP BY category 
                ORDER BY count DESC 
                LIMIT 5
            `);
            return {
                crops: topCrops.rows,
                categories: topCategories.rows
            };
        } catch (error) {
            logger.error('Failed to get search stats:', error);
            return { crops: [], categories: [] };
        }
    }

    /**
     * Ask a question and get a RAG-based answer (with semantic caching)
     */
    static async askQuestion(userId: string, queryText: string): Promise<{ answer: string; contextUsed: SearchResult[]; cached: boolean }> {
        logger.info(`Getting RAG-based answer for query: "${queryText}" (User: ${userId})`);

        // 1. Log the search activity
        const categories = await this.categorizeQuery(queryText);
        await this.logSearch(userId, queryText, categories[0]);

        // 2. Check semantic cache
        const cachedResult = await SemanticCacheService.findSimilar(queryText);
        if (cachedResult) {
            return {
                answer: cachedResult.answer,
                contextUsed: cachedResult.contextUsed,
                cached: true
            };
        }

        // 3. Retrieve relevant context
        const contextResults = await this.searchKnowledge(queryText);
        const contextText = contextResults
            .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}]\n${res.content}`)
            .join('\n\n---\n\n');

        // 4. Generate answer using Reasoning capability of ALFA
        try {
            const reasoningResult = await AIRouter.routeRequest('reason', {
                context: contextText || 'No specific context found in knowledge base.',
                query: queryText,
                options: { temperature: 0.2 }
            });

            const response = {
                answer: reasoningResult.answer,
                contextUsed: contextResults,
                cached: false
            };

            // 5. Store in semantic cache for future requests
            await SemanticCacheService.save(queryText, response.answer, response.contextUsed);

            return response;
        } catch (error) {
            logger.error('RAG analysis failed:', error);
            throw error;
        }
    }

    /**
     * Categorize a query to optimize retrieval
     */
    static async categorizeQuery(queryText: string): Promise<string[]> {
        try {
            const classification = await AIRouter.routeRequest('classify', {
                input: queryText,
                options: {
                    taxonomy: 'crop_types, pest_control, soil_health, weather_advisory, market_prices',
                    multiLabel: true
                }
            });

            return classification.labels
                .filter((l: any) => l.score > 0.5)
                .map((l: any) => l.label);
        } catch (error) {
            logger.error('Query classification failed:', error);
            return ['general'];
        }
    }
}
