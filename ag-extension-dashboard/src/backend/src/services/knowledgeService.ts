import { AIRouter, ReasoningResult } from '@/services/aiProvider/aiProvider';
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
     * Get recent search history for a user (de-duplicated)
     */
    static async getSearchHistory(userId: string, limit: number = 10): Promise<any[]> {
        try {
            // Using a subquery with ROW_NUMBER to only return the latest instance of each unique query
            const result = await query(`
                SELECT id, query as "queryText", category, crop, created_at as "createdAt"
                FROM (
                    SELECT id, query, category, crop, created_at,
                           ROW_NUMBER() OVER (PARTITION BY query ORDER BY created_at DESC) as rn
                    FROM knowledge_searches
                    WHERE user_id = $1
                ) sub
                WHERE sub.rn = 1
                ORDER BY sub.created_at DESC
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
            const totalQueriesResult = await query(`
                SELECT COUNT(*) as count FROM knowledge_searches
            `);
            const cachedResult = await query(`
                SELECT COUNT(*) as count FROM search_cache
            `);
            return {
                crops: topCrops.rows,
                categories: topCategories.rows,
                totalQueries: totalQueriesResult.rows[0]?.count || 0,
                cachedQueries: cachedResult.rows[0]?.count || 0,
            };
        } catch (error) {
            logger.error('Failed to get search stats:', error);
            return { crops: [], categories: [], totalQueries: 0, cachedQueries: 0 };
        }
    }

    /**
     * Ask a question and get a RAG-based answer (with semantic caching and multimodal support)
     */
    static async askQuestion(
        userId: string, 
        queryText: string, 
        attachments?: Array<{ type: 'image' | 'file' | 'audio'; data: string; mimeType?: string }>
    ): Promise<ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }> {
        logger.info(`Getting RAG-based answer for query: "${queryText}" (User: ${userId}, Attachments: ${attachments?.length || 0})`);

        // 1. Log the search activity
        const categories = await this.categorizeQuery(queryText);
        await this.logSearch(userId, queryText, categories[0]);

        // 2. Check semantic cache (only for text-only queries for now)
        if (!attachments || attachments.length === 0) {
            const cachedResult = await SemanticCacheService.findSimilar(queryText);
            if (cachedResult) {
                return {
                    reasoning: 'Retrieved from semantic cache.',
                    answer: cachedResult.answer,
                    contextUsed: cachedResult.contextUsed,
                    cached: true,
                    visuals: cachedResult.visuals
                };
            }
        }

        // 3. Retrieve relevant context
        const contextResults = await this.searchKnowledge(queryText);
        const contextText = contextResults
            .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}] (Type: ${res.metadata.contentType}, URL: ${res.metadata.sourceUrl})\n${res.content}`)
            .join('\n\n---\n\n');

        // 4. Generate answer using Reasoning capability of ALFA
        try {
            const reasoningResult: ReasoningResult = await AIRouter.routeRequest('reason', {
                context: contextText || 'No specific context found in knowledge base.',
                query: queryText,
                attachments: attachments, // Pass multimodal context
                options: { temperature: 0.2 }
            });

            // 5. Generate TTS for audio abstraction (if requested/enabled)
            // We'll generate a short summary for audio playback
            let audioBase64 = undefined;
            try {
                const ttsResult = await AIRouter.routeRequest('generate', {
                    prompt: `Summarize this answer in 2 short, enticing sentences for audio playback: ${reasoningResult.answer}`,
                    options: { maxTokens: 100 }
                });
                if (ttsResult.text) {
                    const audioResult = await AIRouter.routeRequest('speech', { 
                        text: ttsResult.text,
                        options: { voice: 'en-US-AriaNeural' } 
                    });
                    if (audioResult && audioResult.audio) {
                        audioBase64 = audioResult.audio.toString('base64');
                    }
                }
            } catch (ttsError) {
                logger.warn('Failed to generate audio abstraction:', ttsError);
            }

            const response = {
                ...reasoningResult,
                audio: audioBase64,
                contextUsed: contextResults,
                cached: false
            };

            // 6. Store in semantic cache for future requests (only if no attachments)
            if (!attachments || attachments.length === 0) {
                await SemanticCacheService.save(queryText, response.answer, response.contextUsed, response.visuals);
            }

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
