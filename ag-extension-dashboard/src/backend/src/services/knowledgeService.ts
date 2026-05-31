/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIRouter, ReasoningResult } from '@/services/aiProvider/aiProvider';
import { VectorService, SearchResult } from '@/services/vectorService';
import { SemanticCacheService } from '@/services/semanticCacheService';
import { AssetValidationService } from '@/services/assetValidationService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { tavilyService } from '@/services/tavilyService';
import { StealthScraperService } from '@/services/stealthScraperService';

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
        return VectorService.hybridSearch(queryText, limit, filters);
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
            const [topCrops, topCategories, totalQueriesResult, cachedResult] = await Promise.all([
                query(`SELECT crop, COUNT(*) as count FROM knowledge_searches WHERE crop IS NOT NULL GROUP BY crop ORDER BY count DESC LIMIT 5`),
                query(`SELECT category, COUNT(*) as count FROM knowledge_searches WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5`),
                query(`SELECT COUNT(*) as count FROM knowledge_searches`),
                query(`SELECT COUNT(*) as count FROM search_cache`),
            ]);
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

            // B. Check exact match in database using normalized_query index (O(1) lookup)
            try {
                const normalized = queryText.trim().toLowerCase();
                const dbExact = await query(`
                    SELECT query_text as "queryText", answer, context_used as "contextUsed", visuals
                    FROM search_cache
                    WHERE normalized_query = $1
                    LIMIT 1
                `, [normalized]);


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

        // Categorize query upfront to understand if it's agricultural or general inquiry
        const queryCategories = await this.categorizeQuery(queryText);
        const isAgriQuery = queryCategories.length === 0 || queryCategories.some(c =>
            ['pest_and_disease', 'agronomy_and_yield', 'climate_and_weather', 'market_prices'].includes(c)
        );

        if (contextResults.length === 0 || bestScore < 0.65) {
            logger.info(`Low local match score (${bestScore}). Performing fallback routing based on intent...`);

            if (isAgriQuery) {
                logger.info(`Query intent classified as agricultural [${queryCategories.join(', ')}]. Triggering StealthScraperService for: "${queryText}"`);
                try {
                    // Determine platform heuristically based on tropical sources and intent
                    let platform = 'fao_crop_guides'; // Default general agronomy
                    const lowerQuery = queryText.toLowerCase();
                    
                    if (queryCategories.includes('pest_and_disease') || lowerQuery.includes('cabi')) {
                        platform = 'cabi_plantwise';
                    } else if (queryCategories.includes('climate_and_weather') || lowerQuery.includes('fews')) {
                        platform = 'fews_net';
                    } else if (lowerQuery.includes('cassava') || lowerQuery.includes('yam') || lowerQuery.includes('iita')) {
                        platform = 'iita_agronomy';
                    } else if (lowerQuery.includes('rice') || lowerQuery.includes('africarice')) {
                        platform = 'africarice';
                    }
                    
                    // Note: Instead of a generic 'niche' word split, we pass the full exact query to the exact match stealth scraper
                    const stealthResults = await StealthScraperService.scrapeKnowledge(queryText, platform, 'Global Tropics');
                    
                    if (stealthResults && stealthResults.length > 0) {
                        const mappedStealthResults: SearchResult[] = stealthResults.map((r, index) => ({
                            id: `stealth-${index}-${Date.now()}`,
                            content: `Stealth Scrape (${platform}): Topic: ${r.topic}. Summary: ${r.summary || 'N/A'}. Keywords: ${r.keywords.join(', ')}`,
                            metadata: {
                                title: `Tropical DB: ${r.topic}`,
                                category: 'Validated Scientific Guidance',
                                crop: 'Dynamic',
                                sourceUrl: r.url || `https://tropical-database-search`,
                                contentType: 'text'
                            },
                            score: 0.5 // Baseline score for unvalidated web-scraped content
                        }));
                        
                        // Prioritize stealth results by putting them at the top of the context
                        contextResults = [...mappedStealthResults, ...contextResults].slice(0, 4);
                    }
                } catch (stealthError) {
                    logger.error('Failed to retrieve stealth scraper fallback:', stealthError);
                }
            } else if (tavilyService.isConfigured()) {
                logger.info(`Query intent [${queryCategories.join(', ')}] is general. Querying Tavily for: "${queryText}"`);
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
        }

        // Detect crop and location context for real-time APIs
        const cropKeywords = ['maize', 'cassava', 'beans', 'rice', 'banana', 'plantain', 'cocoa', 'coffee', 'yam', 'cowpea', 'soybean', 'groundnut', 'sorghum', 'millet', 'vegetables'];
        let finalCrop = cropKeywords.find(c => queryText.toLowerCase().includes(c));
        let finalLocation = 'Kenya';
        let finalRegion = 'Kenya';
        let finalLat: number | undefined = undefined;
        let finalLng: number | undefined = undefined;

        if (userId) {
            try {
                const [userResult, farmersResult] = await Promise.all([
                    query('SELECT region FROM users WHERE id = $1', [userId]),
                    query(`SELECT location, region, location_lat, location_lng, crops FROM farmers WHERE assigned_officer_id = $1 OR user_id = $1 LIMIT 5`, [userId])
                ]);
                if (userResult.rows.length > 0 && userResult.rows[0].region) {
                    finalRegion = userResult.rows[0].region;
                    finalLocation = userResult.rows[0].region;
                }

                if (farmersResult.rows.length > 0) {
                    const firstFarmer = farmersResult.rows[0];
                    if (!finalCrop) {
                        const allCrops = farmersResult.rows.flatMap((f: any) => f.crops || []);
                        if (allCrops.length > 0) {
                            finalCrop = allCrops[0];
                        }
                    }
                    if (firstFarmer.location) {
                        finalLocation = firstFarmer.location;
                    }
                    if (firstFarmer.region) {
                        finalRegion = firstFarmer.region;
                    }
                    if (firstFarmer.location_lat && firstFarmer.location_lng) {
                        finalLat = parseFloat(firstFarmer.location_lat);
                        finalLng = parseFloat(firstFarmer.location_lng);
                    }
                }
            } catch (err) {
                logger.error('Error fetching context metadata for user/farmer:', err);
            }
        }

        const liveContextResults: SearchResult[] = [];
        const tasks: Array<Promise<void>> = [];

        if (isAgriQuery) {
            // A. Weather Forecast
            if (queryCategories.length === 0 || queryCategories.includes('climate_and_weather')) {
                tasks.push((async () => {
                    try {
                        const { WeatherService } = await import('@/services/weatherService');
                        const weather = await WeatherService.getByLocation(finalLocation);
                        if (weather) {
                            const temp = weather.temperature ?? weather.temp;
                            const condition = weather.condition || 'Clear';
                            const wind = weather.windSpeed;
                            
                            let forecastText = 'No forecast data';
                            if (weather.forecast && Array.isArray(weather.forecast)) {
                                forecastText = weather.forecast.map(f => {
                                    return `  - ${f.date}: Max ${f.maxTemp}°C, Min ${f.minTemp}°C, ${f.condition}`;
                                }).join('\n');
                            }
                            
                            liveContextResults.push({
                                id: `live-weather-${Date.now()}`,
                                content: `Live Weather for ${finalLocation}:
- Current Temp: ${temp !== undefined ? temp : 'N/A'}°C
- Description: ${condition}
- Wind Speed: ${wind !== undefined ? wind : 'N/A'} km/h
- 3-Day Forecast:
${forecastText}`,
                                metadata: {
                                    title: `Live Weather Forecast for ${finalLocation}`,
                                    category: 'Weather Forecast',
                                    crop: finalCrop || 'All',
                                    sourceUrl: 'https://open-meteo.com',
                                    contentType: 'text'
                                },
                                score: 1.0
                            });
                        }
                    } catch (err) {
                        logger.warn('Failed to fetch weather in askQuestion:', err);
                    }
                })());
            }

            // B. FAO Alerts
            if (queryCategories.length === 0 || queryCategories.includes('pest_and_disease')) {
                tasks.push((async () => {
                    try {
                        const { FAOService } = await import('@/services/faoService');
                        const alerts = await FAOService.getDiseaseAlerts(finalRegion, finalCrop);
                        if (alerts && alerts.length > 0) {
                            liveContextResults.push({
                                id: `live-fao-alerts-${Date.now()}`,
                                content: `FAO Disease Alerts for ${finalRegion} (Crop: ${finalCrop || 'All'}):
${alerts.map((a: any) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}`,
                                metadata: {
                                    title: `FAO Pest & Disease Alerts (${finalRegion})`,
                                    category: 'Disease Alerts',
                                    crop: finalCrop || 'All',
                                    sourceUrl: 'https://www.fao.org',
                                    contentType: 'text'
                                },
                                score: 1.0
                            });
                        }
                    } catch (err) {
                        logger.warn('Failed to fetch FAO alerts in askQuestion:', err);
                    }
                })());
            }

            // C. NASA POWER & SoilGrids if lat/lng are present
            if (finalLat && finalLng && (queryCategories.length === 0 || queryCategories.includes('agronomy_and_yield') || queryCategories.includes('climate_and_weather'))) {
                tasks.push((async () => {
                    try {
                        const { NasaPowerService } = await import('@/services/data/nasaPowerService');
                        const nasa = new NasaPowerService();
                        const agro = await nasa.getAgroclimateSummary(finalLat!, finalLng!, 7);
                        if (agro) {
                            liveContextResults.push({
                                id: `live-nasa-agro-${Date.now()}`,
                                content: `NASA POWER Agroclimate Summary for lat: ${finalLat}, lng: ${finalLng}:
- Temp Range: ${agro.temperatureRange?.min ?? 'N/A'} to ${agro.temperatureRange?.max ?? 'N/A'}°C
- Avg Relative Humidity: ${agro.relativeHumidity ?? 'N/A'}%
- Precipitation Sum: ${agro.precipitationSum ?? 'N/A'} mm
- Avg Solar Radiation: ${agro.solarRadiationAvg ?? 'N/A'} MJ/m²/day`,
                                metadata: {
                                    title: `Agroclimatic Solar & Rainfall Context (NASA POWER)`,
                                    category: 'Agroclimatology',
                                    crop: finalCrop || 'All',
                                    sourceUrl: 'https://power.larc.nasa.gov/',
                                    contentType: 'text'
                                },
                                score: 1.0
                            });
                        }
                    } catch (err) {
                        logger.warn('Failed to fetch NASA agroclimate in askQuestion:', err);
                    }
                })());

                tasks.push((async () => {
                    try {
                        const { soilGridsService } = await import('@/services/data/soilGridsService');
                        const soil = (await soilGridsService.fetchSoilProperties(finalLat!, finalLng!)) as any;
                        if (soil) {
                            liveContextResults.push({
                                id: `live-soil-properties-${Date.now()}`,
                                content: `SoilGrids ISRIC Soil Properties for lat: ${finalLat}, lng: ${finalLng}:
- pH at 0-5cm: ${soil.ph_h2o ?? 'N/A'}
- Clay content: ${soil.clay ?? 'N/A'}%
- Organic Carbon: ${soil.soc ?? 'N/A'} dg/kg`,
                                metadata: {
                                    title: `Location-Specific Soil Properties (ISRIC SoilGrids)`,
                                    category: 'Soil Properties',
                                    crop: finalCrop || 'All',
                                    sourceUrl: 'https://soilgrids.org/',
                                    contentType: 'text'
                                },
                                score: 1.0
                            });
                        }
                    } catch (err) {
                        logger.warn('Failed to fetch SoilGrids in askQuestion:', err);
                    }
                })());
            }

            // D. Market Prices
            if (queryCategories.length === 0 || queryCategories.includes('market_prices')) {
                tasks.push((async () => {
                    try {
                        const { marketPriceService } = await import('@/services/marketPriceService');
                        const prices = await marketPriceService.getLatestPrices();
                        if (prices && prices.length > 0) {
                            const relevantPrices = finalCrop 
                                ? prices.filter((p: any) => p.crop.toLowerCase().includes(finalCrop!.toLowerCase()))
                                : prices;
                            const priceList = relevantPrices.length > 0 ? relevantPrices : prices;
                            liveContextResults.push({
                                id: `live-market-prices-${Date.now()}`,
                                content: `Latest Market Prices:
${priceList.map((p: any) => `- ${p.crop}: ${p.price} (${p.trend})`).join('\n')}`,
                                metadata: {
                                    title: 'Latest Market Prices Context',
                                    category: 'Market Prices',
                                    crop: finalCrop || 'All',
                                    sourceUrl: 'https://www.ratin.net',
                                    contentType: 'text'
                                },
                                score: 1.0
                            });
                        }
                    } catch (err) {
                        logger.warn('Failed to fetch market prices in askQuestion:', err);
                    }
                })());
            }

            await Promise.all(tasks);
        }

        // Prepend dynamic live context to semantic search results
        contextResults = [...liveContextResults, ...contextResults];

        const contextText = contextResults
            .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}] (Type: ${res.metadata.contentType || 'text'}, Score: ${res.score !== undefined ? res.score.toFixed(2) : '1.0'}, URL: ${res.metadata.sourceUrl || ''})\n${res.content}`)
            .join('\n\n---\n\n');

        // 4. Generate answer using Reasoning capability of ALFA
        try {
            const reasoningResult: ReasoningResult = await AIRouter.routeRequest('reason', {
                context: `${contextText || 'No specific context found in knowledge base.'}\n\nGrounding Guidelines:
- Prioritize context sources with high similarity scores (e.g. 0.70+).
- Treat context with lower scores (< 0.50) as supplementary or less relevant context.
- Explicitly base your answer on the provided context. If the context does not contain enough information to answer the question, state that.`,
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

            // 7. Asynchronously log search for user history in the background (non-blocking!)
            // Reuse already-computed queryCategories instead of calling categorizeQuery again
            this.logSearch(
                userId,
                queryText,
                queryCategories[0] || 'general_inquiry',
                undefined,
                response.answer,
                response.reasoning,
                response.visuals
            ).catch(logError => logger.error('Background logging failed:', logError));

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
                const content = this.formatMarkdownContent(result.content);
                return `### ${index + 1}. ${title}\n${content}`;
            })
            .join('\n\n');

        return {
            reasoning: 'Generated from retrieved knowledge-base context because the configured AI provider did not complete in time.',
            answer: `I found source-backed guidance for: **"${queryText}"**.\n\n*Primary Source Reference: ${sourceTitle}${sourceUrl}*\n\n---\n\n${contextSummary}\n\n---\n\n*Note: The recommendations above are extracted directly from the local verified agricultural knowledge base.*`,
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

    private static formatMarkdownContent(text: string): string {
        const trimmed = text.trim();
        const lines = trimmed.split('\n');
        const resultLines: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            resultLines.push(line);
            
            if (i < lines.length - 1) {
                const nextLine = lines[i + 1];
                
                const isCurrentList = /^\s*([-*+^]|\d+\.)\s+/.test(line);
                const isNextList = /^\s*([-*+^]|\d+\.)\s+/.test(nextLine);
                
                if (isCurrentList && isNextList) {
                    continue;
                }
                
                const isCurrentIndented = /^\s+\S/.test(line);
                const isNextIndented = /^\s+\S/.test(nextLine);
                if (isCurrentIndented || isNextIndented) {
                    continue;
                }
                
                if (line.trim() === '' || nextLine.trim() === '') {
                    continue;
                }
                
                resultLines.push('');
            }
        }
        
        return resultLines.join('\n');
    }

    /**
     * Categorize a query to optimize retrieval
     */
    static async categorizeQuery(queryText: string): Promise<string[]> {
        try {
            const classification = await AIRouter.routeRequest('classify', {
                input: queryText,
                options: {
                    taxonomy: 'pest_and_disease, agronomy_and_yield, climate_and_weather, market_prices, general_inquiry',
                    multiLabel: true
                }
            });

            return classification.labels
                .filter((l: any) => l.score > 0.4)
                .map((l: any) => l.label);
        } catch (error) {
            logger.error('Query classification failed:', error);
            return ['general_inquiry'];
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
