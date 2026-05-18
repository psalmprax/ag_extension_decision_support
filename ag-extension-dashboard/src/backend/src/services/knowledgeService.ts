import { AIRouter, ReasoningResult } from '@/services/aiProvider/aiProvider';
import { VectorService, SearchResult } from '@/services/vectorService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { AssetValidationService } from '@/services/assetValidationService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { tavilyService } from '@/services/tavilyService';

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
    static async searchKnowledge(queryText: string, limit: number = 3, filters: { category?: string; crop?: string } = {}): Promise<SearchResult[]> {
        return VectorService.search(queryText, limit, filters);
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
        visuals?: any
    ): Promise<void> {
        try {
            await query(`
                INSERT INTO knowledge_searches (user_id, query, category, crop, answer, reasoning, visuals, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [userId, queryText, category, crop, answer, reasoning, visuals ? JSON.stringify(visuals) : null]);
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
                SELECT id, query as "queryText", answer, reasoning, visuals, category, crop, created_at as "createdAt"
                FROM (
                    SELECT id, query, answer, reasoning, visuals, category, crop, created_at,
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

        const redisKey = `rag:exact:${queryText.toLowerCase().trim()}`;

        // 1. Check exact match cache (Redis + SQL) first (super fast, 0-1ms, zero LLM calls)
        if (!attachments || attachments.length === 0) {
            // A. Check Redis
            const cachedResponse = await cacheGet(redisKey);
            if (cachedResponse) {
                try {
                    const parsed = JSON.parse(cachedResponse);
                    logger.info(`Redis exact match HIT for query: "${queryText}"`);
                    return {
                        ...parsed,
                        cached: true
                    };
                } catch (e) {
                    logger.error('Failed to parse cached Redis response:', e);
                }
            }

            // B. Check exact match in database (fast, no embedding API call required)
            try {
                const dbExact = await query(`
                    SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals
                    FROM search_cache
                    WHERE LOWER(TRIM(query_text)) = LOWER(TRIM($1))
                    LIMIT 1
                `, [queryText]);

                if (dbExact.rows.length > 0) {
                    const cached = dbExact.rows[0];
                    const resPayload = {
                        reasoning: 'Retrieved from exact search cache.',
                        answer: cached.answer,
                        contextUsed: typeof cached.contextUsed === 'string' ? JSON.parse(cached.contextUsed) : cached.contextUsed,
                        visuals: typeof cached.visuals === 'string' ? JSON.parse(cached.visuals) : cached.visuals
                    };
                    logger.info(`Database exact match HIT for query: "${queryText}"`);
                    // Populate Redis for subsequent hits
                    await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
                    return {
                        ...resPayload,
                        cached: true
                    };
                }
            } catch (dbError) {
                logger.error('Exact DB cache search failed:', dbError);
            }

            // 2. Check semantic vector cache (requires 1 embedding call)
            const cachedResult = await SemanticCacheService.findSimilar(queryText);
            if (cachedResult) {
                const resPayload = {
                    reasoning: 'Retrieved from semantic cache.',
                    answer: cachedResult.answer,
                    contextUsed: cachedResult.contextUsed,
                    visuals: cachedResult.visuals
                };
                // Populate Redis for subsequent exact hits
                await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
                return {
                    ...resPayload,
                    cached: true
                };
            }
        }

        // 3. Retrieve relevant context (cache miss)
        let contextResults = await this.searchKnowledge(queryText);
        const bestScore = contextResults.length > 0 ? contextResults[0].score : 0;
        if ((contextResults.length === 0 || bestScore < 0.65) && tavilyService.isConfigured()) {
            logger.info(`No high-scoring local matches found (best score: ${bestScore}). Querying Tavily for: "${queryText}"`);
            try {
                const webResults = await tavilyService.search(queryText, 3);
                if (webResults && webResults.results && webResults.results.length > 0) {
                    const mappedWebResults: SearchResult[] = webResults.results.map((r, index) => ({
                        id: `web-${index}-${Date.now()}`,
                        content: r.content,
                        metadata: {
                            title: r.title,
                            category: 'External Reference',
                            crop: 'All',
                            sourceUrl: r.url,
                            contentType: 'text'
                        },
                        score: r.score
                    }));
                    contextResults = [...mappedWebResults, ...contextResults].slice(0, 4);
                }
            } catch (webError) {
                logger.error('Failed to retrieve external search fallback:', webError);
            }
        }

        const contextText = contextResults
            .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}] (Type: ${res.metadata.contentType || 'text'}, URL: ${res.metadata.sourceUrl || ''})\n${res.content}`)
            .join('\n\n---\n\n');

        // 4. Generate answer using Reasoning capability of ALFA
        try {
            const reasoningResult: ReasoningResult = await AIRouter.routeRequest('reason', {
                context: contextText || 'No specific context found in knowledge base.',
                query: queryText,
                attachments: attachments, // Pass multimodal context
                options: { temperature: 0.2, maxTokens: 900 }
            });

            // 5. Generate TTS and validate visuals in parallel using Promise.all (saves ~2-3 seconds!)
            let audioBase64: string | undefined = undefined;
            let enhancedVisuals = reasoningResult.visuals;

            await Promise.all([
                // A. Visual validation & enhancement
                (async () => {
                    if (reasoningResult.visuals) {
                        enhancedVisuals = await this.validateAndEnhanceVisuals(reasoningResult.visuals, queryText);
                    }
                })(),
                // B. Audio summary and voice generation
                (async () => {
                    if (process.env.KNOWLEDGE_TTS_ENABLED !== 'true') {
                        return;
                    }

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
                        logger.warn('Failed to generate audio abstraction in parallel:', ttsError);
                    }
                })()
            ]);

            const response = {
                ...reasoningResult,
                visuals: enhancedVisuals,
                audio: audioBase64,
                contextUsed: contextResults,
                cached: false
            };

            // 6. Asynchronously store in semantic and Redis caches (non-blocking!)
            if (!attachments || attachments.length === 0) {
                cacheSet(redisKey, JSON.stringify(response), 3600 * 24).catch(e => logger.error('Failed to set Redis exact cache:', e));
                SemanticCacheService.save(queryText, response.answer, response.contextUsed, response.visuals).catch(e => logger.error('Failed to save semantic cache:', e));
            }

            // 7. Asynchronously categorize the query and log search for user history in the background (non-blocking!)
            (async () => {
                try {
                    const categories = await this.categorizeQuery(queryText);
                    await this.logSearch(
                        userId, 
                        queryText, 
                        categories[0], 
                        undefined, 
                        response.answer,
                        response.reasoning,
                        response.visuals
                    );
                } catch (logError) {
                    logger.error('Background classification or logging failed:', logError);
                }
            })();

            return response;
        } catch (error) {
            logger.error('RAG analysis failed:', error);

            if (contextResults.length > 0) {
                const fallback = this.buildExtractiveAnswer(queryText, contextResults);
                this.logSearch(
                    userId,
                    queryText,
                    contextResults[0]?.metadata?.category,
                    contextResults[0]?.metadata?.crop,
                    fallback.answer,
                    fallback.reasoning,
                    fallback.visuals
                ).catch(logError => logger.error('Fallback search logging failed:', logError));
                return fallback;
            }

            throw error;
        }
    }

    private static buildExtractiveAnswer(queryText: string, contextResults: SearchResult[]): ReasoningResult & { cached: boolean; contextUsed: SearchResult[] } {
        const primary = contextResults[0];
        const sourceTitle = primary.metadata?.title || `${primary.metadata?.crop || 'Agricultural'} ${primary.metadata?.category || 'Knowledge'}`;
        const sourceUrl = primary.metadata?.sourceUrl ? ` (${primary.metadata.sourceUrl})` : '';
        const contextSummary = contextResults
            .slice(0, 3)
            .map((result, index) => {
                const title = result.metadata?.title || `Source ${index + 1}`;
                return `${index + 1}. ${title}: ${result.content}`;
            })
            .join('\n\n');

        return {
            reasoning: 'Generated from retrieved knowledge-base context because the configured AI provider did not complete in time.',
            answer: `I found source-backed guidance for: "${queryText}".\n\nPrimary source: ${sourceTitle}${sourceUrl}\n\n${contextSummary}\n\nThe answer above is extracted directly from the local knowledge base so it remains available even when the AI reasoning provider is slow or unavailable.`,
            confidence: Math.max(0.5, Math.min(primary.score || 0.7, 0.95)),
            visuals: {
                kpis: [
                    { label: 'Source Matches', value: String(contextResults.length), status: 'good' },
                    { label: 'Top Match Score', value: (primary.score ?? 0).toFixed(2), status: (primary.score ?? 0) >= 0.65 ? 'good' : 'warning' }
                ],
                charts: [],
                images: [],
                videos: []
            },
            contextUsed: contextResults,
            cached: false
        };
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

    /**
     * Validates and enhances visual assets with runtime checks
     */
    static async validateAndEnhanceVisuals(visuals: any, searchQuery: string): Promise<any> {
        const enhancedVisuals = { ...visuals };

        // Validate image URLs
        if (enhancedVisuals.images && enhancedVisuals.images.length > 0) {
            const validImageUrls = await AssetValidationService.validateAssetUrls(
                enhancedVisuals.images.map((img: any) => img.url)
            );

            // Filter to only valid images
            enhancedVisuals.images = enhancedVisuals.images.filter((img: any) =>
                validImageUrls.includes(img.url)
            );

            // If we have fewer than desired images, try to get more relevant ones
            if (enhancedVisuals.images.length < 2) {
                try {
                    const additionalImages = await AssetValidationService.getRelevantImages(searchQuery, 3);
                    const existingUrls = new Set(enhancedVisuals.images.map((img: any) => img.url));

                    for (const additional of additionalImages) {
                        if (!existingUrls.has(additional.url)) {
                            enhancedVisuals.images.push({
                                url: additional.url,
                                caption: `Verified agricultural image (${additional.category})`
                            });
                            if (enhancedVisuals.images.length >= 3) break;
                        }
                    }
                } catch (error) {
                    logger.warn('Failed to get additional relevant images:', error);
                }
            }
        }

        // Validate video URLs
        if (enhancedVisuals.videos && enhancedVisuals.videos.length > 0) {
            const validVideoUrls = await AssetValidationService.validateAssetUrls(
                enhancedVisuals.videos.map((vid: any) => vid.url)
            );

            enhancedVisuals.videos = enhancedVisuals.videos.filter((vid: any) =>
                validVideoUrls.includes(vid.url)
            );
        }

        // Ensure we have at least some visuals if possible
        if ((!enhancedVisuals.images || enhancedVisuals.images.length === 0) &&
            (!enhancedVisuals.charts || enhancedVisuals.charts.length === 0)) {
            try {
                logger.info(`No visuals found for query "${searchQuery}", attempting to get relevant images`);
                const relevantImages = await AssetValidationService.getRelevantImages(searchQuery, 2);

                if (relevantImages.length > 0) {
                    enhancedVisuals.images = relevantImages.map(img => ({
                        url: img.url,
                        caption: `Agricultural reference image (${img.category})`
                    }));
                }
            } catch (error) {
                logger.warn('Failed to get fallback images:', error);
            }
        }

        return enhancedVisuals;
    }
}
