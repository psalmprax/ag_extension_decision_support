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
import { mcpAdapter } from '@/services/mcpAdapter';

const STATS_CACHE_KEY = 'knowledge:search:stats';
const STATS_CACHE_TTL = 300; // 5 minutes

export type KnowledgeEvidenceStatus = 'verified_sources' | 'context_only' | 'no_verified_source';

export function getKnowledgeEvidenceStatus(citationCount: number, contextCount: number, maxScore?: number): KnowledgeEvidenceStatus {
    const hasStrongCitations = citationCount >= 2 && (maxScore === undefined || maxScore >= 0.75);
    if (hasStrongCitations) return 'verified_sources';
    if (citationCount > 0 && (maxScore === undefined || maxScore >= 0.5)) return 'verified_sources';
    if (contextCount > 0) return 'context_only';
    return 'no_verified_source';
}

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
        visuals?: Record<string, any>
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
    static async getSearchHistory(userId: string, limit: number = 10): Promise<Record<string, any>[]> {
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
     * Cached in Redis for 5 minutes to avoid repeated expensive queries
     */
    static async getSearchStats(): Promise<Record<string, any>> {
        try {
            // Check Redis cache first
            const cachedStats = await cacheGet(STATS_CACHE_KEY);
            if (cachedStats) {
                logger.debug('Search stats cache HIT');
                return JSON.parse(cachedStats);
            }

            logger.debug('Search stats cache MISS — querying database');
            const [topCrops, topCategories, totalQueriesResult, cachedResult] = await Promise.all([
                query(`SELECT crop, COUNT(*) as count FROM knowledge_searches WHERE crop IS NOT NULL GROUP BY crop ORDER BY count DESC LIMIT 5`),
                query(`SELECT category, COUNT(*) as count FROM knowledge_searches WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5`),
                query(`SELECT COUNT(*) as count FROM knowledge_searches`),
                query(`SELECT COUNT(*) as count FROM search_cache`),
            ]);

            const stats = {
                crops: topCrops.rows,
                categories: topCategories.rows,
                totalQueries: totalQueriesResult.rows[0]?.count || 0,
                cachedQueries: cachedResult.rows[0]?.count || 0,
            };

            // Cache in Redis with 5-minute TTL (non-blocking)
            cacheSet(STATS_CACHE_KEY, JSON.stringify(stats), STATS_CACHE_TTL)
                .catch(e => logger.error('Failed to cache search stats:', e));

            return stats;
        } catch (error) {
            logger.error('Failed to get search stats:', error);
            return { crops: [], categories: [], totalQueries: 0, cachedQueries: 0 };
        }
    }

    private static async checkCaches(
        queryText: string,
        redisKey: string
    ): Promise<(ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }) | null> {
        // A. Check Redis
        const cachedResponse = await cacheGet(redisKey);
        if (cachedResponse) {
            try {
                const parsed = JSON.parse(cachedResponse);
                logger.info(`Redis exact match HIT for query: "${queryText}"`);
                return { ...parsed, cached: true };
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
                await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
                return { ...resPayload, cached: true };
            }
        } catch (dbError) {
            logger.error('Exact DB cache search failed:', dbError);
        }

        // C. Check semantic vector cache (requires 1 embedding call)
        const cachedResult = await SemanticCacheService.findSimilar(queryText);
        if (cachedResult) {
            const resPayload = {
                reasoning: 'Retrieved from semantic cache.',
                answer: cachedResult.answer,
                contextUsed: cachedResult.contextUsed,
                visuals: cachedResult.visuals
            };
            await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
            return { ...resPayload, cached: true };
        }

        return null;
    }

    private static async checkExactCachesOnly(
        queryText: string,
        redisKey: string
    ): Promise<(ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }) | null> {
        const cachedResponse = await cacheGet(redisKey);
        if (cachedResponse) {
            try {
                const parsed = JSON.parse(cachedResponse);
                logger.info(`Redis exact match HIT (fresh) for query: "${queryText}"`);
                return { ...parsed, cached: true };
            } catch (e) { logger.error('Failed to parse cached Redis response:', e); }
        }
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
                logger.info(`Database exact match HIT (fresh) for query: "${queryText}"`);
                await cacheSet(redisKey, JSON.stringify(resPayload), 3600 * 24);
                return { ...resPayload, cached: true };
            }
        } catch (dbError) { logger.error('Exact DB cache search failed:', dbError); }
        return null;
    }

    private static async fallbackAgriQuery(queryText: string, queryCategories: string[], currentResults: SearchResult[]): Promise<SearchResult[]> {
        logger.info(`Query intent classified as agricultural [${queryCategories.join(', ')}]. Triggering StealthScraperService for: "${queryText}"`);
        try {
            let platform = 'fao_crop_guides';
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
            
            const stealthResults = await Promise.race([
                StealthScraperService.scrapeKnowledge(queryText, platform, 'Global Tropics'),
                new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('StealthScraperService.scrapeKnowledge timed out after 30s')), 30000)
                )
            ]) as any[] | null;
            
            if (stealthResults && stealthResults.length > 0) {
                const mappedStealthResults: SearchResult[] = stealthResults.map((r, index) => ({
                    id: `stealth-${index}-${Date.now()}`,
                    content: `Stealth Scrape (${platform}): Topic: ${r.topic}. Summary: ${r.summary || 'N/A'}. Keywords: ${r.keywords.join(', ')}`,
                    metadata: {
                        title: `Tropical DB: ${r.topic}`,
                        category: 'Validated Scientific Guidance',
                        crop: 'Dynamic',
                        sourceUrl: r.url || 'https://www.fao.org/pest-and-pesticide-management/en/',
                        contentType: 'text'
                    },
                    score: 0.5
                }));
                return [...mappedStealthResults, ...currentResults].slice(0, 4);
            }
        } catch (stealthError) {
            logger.error('Failed to retrieve stealth scraper fallback:', stealthError);
        }
        return currentResults;
    }

    private static async fallbackGeneralQuery(queryText: string, currentResults: SearchResult[]): Promise<SearchResult[]> {
        logger.info(`Query intent is general. Querying Tavily for: "${queryText}"`);
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
                return [...mappedWebResults, ...currentResults].slice(0, 4);
            }
        } catch (webError) {
            logger.error('Failed to retrieve external search fallback:', webError);
        }
        return currentResults;
    }

    private static async fetchViaJina(url: string): Promise<string | null> {
        try {
            const jinaUrl = `https://r.jina.ai/${url}`;
            const { default: axios } = await import('axios');
            const resp = await axios.get(jinaUrl, { timeout: 8000, headers: { 'Accept': 'text/markdown' } });
            const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
            return text.slice(0, 4000);
        } catch { return null; }
    }

    private static async enrichContextWithWebFallbacks(
        queryText: string,
        queryCategories: string[],
        isAgriQuery: boolean,
        contextResults: SearchResult[]
    ): Promise<SearchResult[]> {
        const fetchedAt = new Date().toISOString();
        const isRealTimeIntent = queryCategories.some(c => ['market_and_commodity_prices', 'climate_and_weather'].includes(c));

        // Always attempt fresh web retrieval for real-time intents or when local score is weak
        const needsFreshWeb = isRealTimeIntent || contextResults.length === 0 || (contextResults[0].score !== undefined && contextResults[0].score < 0.85);
        if (!needsFreshWeb && !isRealTimeIntent) {
            // Attach fetchedAt to existing results for citation freshness
            return contextResults.map(r => ({
                ...r,
                metadata: { ...r.metadata, fetchedAt: (r.metadata as Record<string, unknown>).fetchedAt || fetchedAt } as SearchResult['metadata'],
            }));
        }

        logger.info(`Enriching context with always-fresh Tavily (5, advanced, week) + Jina for: "${queryText}" (realTime=${isRealTimeIntent})`);
        let webResults: SearchResult[] = [];
        try {
            const tavilyRes = await tavilyService.search(queryText, 5, { searchDepth: 'advanced', timeRange: 'week', includeAnswer: false });
            if (tavilyRes?.results?.length) {
                const enriched = await Promise.all(tavilyRes.results.slice(0, 5).map(async (r, idx) => {
                    const jinaContent = await this.fetchViaJina(r.url);
                    const content = jinaContent || r.content;
                    return {
                        id: `web-${idx}-${Date.now()}`,
                        content,
                        metadata: {
                            title: r.title,
                            category: 'External Reference',
                            crop: 'All',
                            sourceUrl: r.url,
                            contentType: 'text',
                            fetchedAt,
                            publishedDate: (r as unknown as { published_date?: string }).published_date || fetchedAt,
                        },
                        score: r.score
                    } as SearchResult;
                }));
                webResults = enriched;
            }
        } catch (e) { logger.warn('Tavily/Jina enrichment failed, continuing with local:', e); }

        // Fallback to agri-specific scraper only if Tavily yielded nothing and is agri query
        if (webResults.length === 0 && isAgriQuery) {
            webResults = await this.fallbackAgriQuery(queryText, queryCategories, []);
        }

        const combined = [...webResults, ...contextResults];
        // Deduplicate by sourceUrl/content hash, keep highest score
        const seen = new Map<string, SearchResult>();
        for (const r of combined) {
            const key = (r.metadata?.sourceUrl as string) || r.content.slice(0, 200);
            const existing = seen.get(key);
            if (!existing || (r.score || 0) > (existing.score || 0)) seen.set(key, { ...r, metadata: { ...r.metadata, fetchedAt: (r.metadata as Record<string, unknown>).fetchedAt || fetchedAt } as SearchResult['metadata'] });
        }
        let merged = Array.from(seen.values());
        // Rerank 12 candidates → top 4 using RAGv2 reranker when available
        if (merged.length > 1) {
            try {
                const { RAGV2Service } = await import('@/services/ragV2Service');
                const ranked = await RAGV2Service.rerank(queryText, merged.map(m => ({
                    id: m.id, articleId: m.id, content: m.content, metadata: m.metadata as Record<string, unknown>, score: m.score || 0.5, citation: (m.metadata?.title as string) || ''
                })), 4);
                merged = ranked.map(rr => ({
                    id: rr.id, content: rr.content, metadata: { ...rr.metadata, fetchedAt: (rr.metadata as Record<string, unknown>).fetchedAt || fetchedAt } as SearchResult['metadata'], score: rr.rerankScore ?? rr.score
                }));
            } catch { merged.sort((a, b) => (b.score || 0) - (a.score || 0)); merged = merged.slice(0, 4); }
        } else {
            merged = merged.slice(0, 4);
        }
        return merged;
    }

    private static assignUserRegion(userResult: Record<string, any>, finalData: Record<string, any>) {
        if (userResult.rows.length > 0 && userResult.rows[0].region) {
            finalData.finalRegion = userResult.rows[0].region;
            finalData.finalLocation = userResult.rows[0].region;
        }
    }

    private static assignFarmerData(farmersResult: Record<string, any>, finalData: Record<string, any>) {
        if (farmersResult.rows.length === 0) return;
        
        const firstFarmer = farmersResult.rows[0];
        if (!finalData.finalCrop) {
            const allCrops = farmersResult.rows.flatMap((f: Record<string, any>) => f.crops || []);
            if (allCrops.length > 0) {
                finalData.finalCrop = allCrops[0];
            }
        }
        if (firstFarmer.location) finalData.finalLocation = firstFarmer.location;
        if (firstFarmer.region) finalData.finalRegion = firstFarmer.region;
        if (firstFarmer.location_lat && firstFarmer.location_lng) {
            finalData.finalLat = parseFloat(firstFarmer.location_lat);
            finalData.finalLng = parseFloat(firstFarmer.location_lng);
        }
    }

    private static async fetchUserAndFarmerContext(userId: string, finalData: Record<string, any>) {
        try {
            const [userResult, farmersResult] = await Promise.all([
                query('SELECT region FROM users WHERE id = $1', [userId]),
                query(`SELECT location, region, location_lat, location_lng, crops FROM farmers WHERE assigned_officer_id = $1 OR user_id = $1 LIMIT 5`, [userId])
            ]);
            
            this.assignUserRegion(userResult, finalData);
            this.assignFarmerData(farmersResult, finalData);
        } catch (err) {
            logger.error('Error fetching context metadata for user/farmer:', err);
        }
    }

    private static async resolveUserContext(
        userId: string,
        queryText: string
    ): Promise<{ crop: string | undefined; location?: string; region?: string; lat?: number; lng?: number }> {
        const cropKeywords = ['maize', 'cassava', 'beans', 'rice', 'banana', 'plantain', 'cocoa', 'coffee', 'yam', 'cowpea', 'soybean', 'groundnut', 'sorghum', 'millet', 'vegetables', 'tomato', 'potato', 'wheat', 'barley', 'oats', 'apples', 'cherries', 'blueberries'];
        
        const finalData: Record<string, any> = {
            finalCrop: cropKeywords.find(c => queryText.toLowerCase().includes(c)),
            finalLocation: undefined,
            finalRegion: undefined,
            finalLat: undefined,
            finalLng: undefined
        };

        if (userId) {
            await this.fetchUserAndFarmerContext(userId, finalData);
        }
        return { crop: finalData.finalCrop, location: finalData.finalLocation, region: finalData.finalRegion, lat: finalData.finalLat, lng: finalData.finalLng };
    }

    private static async fetchWeatherContext(queryCategories: string[], location?: string, crop?: string): Promise<SearchResult | null> {
        if (!location) return null;
        if (queryCategories.length > 0 && !queryCategories.includes('climate_and_weather')) return null;
        try {
            const { WeatherService } = await import('@/services/weatherService');
            const weather = await WeatherService.getByLocation(location);
            if (weather) {
                const temp = weather.temperature ?? weather.temp;
                const condition = weather.condition || 'Clear';
                const wind = weather.windSpeed;
                
                let forecastText = 'No forecast data';
                if (weather.forecast && Array.isArray(weather.forecast)) {
                    forecastText = weather.forecast.map(f => `  - ${f.date}: Max ${f.maxTemp}°C, Min ${f.minTemp}°C, ${f.condition}`).join('\n');
                }
                
                return {
                    id: `live-weather-${Date.now()}`,
                    content: `Live Weather for ${location}:\n- Current Temp: ${temp !== undefined ? temp : 'N/A'}°C\n- Description: ${condition}\n- Wind Speed: ${wind !== undefined ? wind : 'N/A'} km/h\n- 3-Day Forecast:\n${forecastText}`,
                    metadata: { title: `Live Weather Forecast for ${location}`, category: 'Weather Forecast', crop: crop || 'All', sourceUrl: 'https://open-meteo.com', contentType: 'text' },
                    score: 1.0
                };
            }
        } catch (err) { logger.warn('Failed to fetch weather in askQuestion:', err); }
        return null;
    }

    private static async fetchFAOAlertsContext(queryCategories: string[], region?: string, crop?: string): Promise<SearchResult | null> {
        if (!region) return null;
        if (queryCategories.length > 0 && !queryCategories.includes('pest_and_disease')) return null;
        try {
            const { FAOService } = await import('@/services/faoService');
            const alerts = await FAOService.getDiseaseAlerts(region, crop);
            if (alerts && alerts.length > 0) {
                return {
                    id: `live-fao-alerts-${Date.now()}`,
                    content: `FAO Disease Alerts for ${region} (Crop: ${crop || 'All'}):\n${alerts.map((a: Record<string, any>) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}`,
                    metadata: { title: `FAO Pest & Disease Alerts (${region})`, category: 'Disease Alerts', crop: crop || 'All', sourceUrl: 'https://www.fao.org', contentType: 'text' },
                    score: 1.0
                };
            }
        } catch (err) { logger.warn('Failed to fetch FAO alerts in askQuestion:', err); }
        return null;
    }

    private static async fetchNasaAgroclimateContext(queryCategories: string[], lat: number | undefined, lng: number | undefined, crop: string | undefined): Promise<SearchResult | null> {
        if (!lat || !lng) return null;
        if (queryCategories.length > 0 && !queryCategories.includes('agronomy_and_yield') && !queryCategories.includes('climate_and_weather')) return null;
        try {
            const { NasaPowerService } = await import('@/services/data/nasaPowerService');
            const nasa = new NasaPowerService();
            const agro = await nasa.getAgroclimateSummary(lat, lng, 7);
            if (agro) {
                const tempMin = agro.temperatureRange?.min ?? 'N/A';
                const tempMax = agro.temperatureRange?.max ?? 'N/A';
                const rh = agro.relativeHumidity ?? 'N/A';
                const precip = agro.precipitationSum ?? 'N/A';
                const solar = agro.solarRadiationAvg ?? 'N/A';
                return {
                    id: `live-nasa-agro-${Date.now()}`,
                    content: `NASA POWER Agroclimate Summary for lat: ${lat}, lng: ${lng}:\n- Temp Range: ${tempMin} to ${tempMax}°C\n- Avg Relative Humidity: ${rh}%\n- Precipitation Sum: ${precip} mm\n- Avg Solar Radiation: ${solar} MJ/m²/day`,
                    metadata: { title: `Agroclimatic Solar & Rainfall Context (NASA POWER)`, category: 'Agroclimatology', crop: crop || 'All', sourceUrl: 'https://power.larc.nasa.gov/', contentType: 'text' },
                    score: 1.0
                };
            }
        } catch (err) { logger.warn('Failed to fetch NASA agroclimate in askQuestion:', err); }
        return null;
    }

    private static async fetchSoilPropertiesContext(queryCategories: string[], lat: number | undefined, lng: number | undefined, crop: string | undefined): Promise<SearchResult | null> {
        if (!lat || !lng) return null;
        if (queryCategories.length > 0 && !queryCategories.includes('agronomy_and_yield') && !queryCategories.includes('climate_and_weather')) return null;
        try {
            const { soilGridsService } = await import('@/services/data/soilGridsService');
            const soil = (await soilGridsService.fetchSoilProperties(lat, lng)) as Record<string, any>;
            if (soil) {
                const ph = soil.ph_h2o ?? 'N/A';
                const clay = soil.clay ?? 'N/A';
                const soc = soil.soc ?? 'N/A';
                return {
                    id: `live-soil-properties-${Date.now()}`,
                    content: `SoilGrids ISRIC Soil Properties for lat: ${lat}, lng: ${lng}:\n- pH at 0-5cm: ${ph}\n- Clay content: ${clay}%\n- Organic Carbon: ${soc} dg/kg`,
                    metadata: { title: `Location-Specific Soil Properties (ISRIC SoilGrids)`, category: 'Soil Properties', crop: crop || 'All', sourceUrl: 'https://soilgrids.org/', contentType: 'text' },
                    score: 1.0
                };
            }
        } catch (err) { logger.warn('Failed to fetch SoilGrids in askQuestion:', err); }
        return null;
    }

    private static async fetchMarketPricesContext(queryCategories: string[], crop: string | undefined): Promise<SearchResult | null> {
        if (queryCategories.length > 0 && !queryCategories.includes('market_prices')) return null;
        try {
            const { marketPriceService } = await import('@/services/marketPriceService');
            const prices = await marketPriceService.getLatestPrices();
            if (prices && prices.length > 0) {
                const relevantPrices = crop ? prices.filter((p: Record<string, any>) => p.crop.toLowerCase().includes(crop.toLowerCase())) : prices;
                const priceList = relevantPrices.length > 0 ? relevantPrices : prices;
                return {
                    id: `live-market-prices-${Date.now()}`,
                    content: `Latest Market Prices:\n${priceList.map((p: Record<string, any>) => `- ${p.crop}: ${p.price} (${p.trend})`).join('\n')}`,
                    metadata: { title: 'Latest Market Prices Context', category: 'Market Prices', crop: crop || 'All', sourceUrl: 'https://www.ratin.net', contentType: 'text' },
                    score: 1.0
                };
            }
        } catch (err) { logger.warn('Failed to fetch market prices in askQuestion:', err); }
        return null;
    }

    private static async fetchLiveAgriContext(
        queryCategories: string[],
        location: { crop?: string; location?: string; region?: string; lat?: number; lng?: number }
    ): Promise<SearchResult[]> {
        const tasks: Array<Promise<SearchResult | null>> = [
            this.fetchWeatherContext(queryCategories, location.location, location.crop),
            this.fetchFAOAlertsContext(queryCategories, location.region, location.crop),
            this.fetchNasaAgroclimateContext(queryCategories, location.lat, location.lng, location.crop),
            this.fetchSoilPropertiesContext(queryCategories, location.lat, location.lng, location.crop),
            this.fetchMarketPricesContext(queryCategories, location.crop)
        ];

        const results = await Promise.all(tasks);
        return results.filter((r): r is SearchResult => r !== null);
    }

    private static async callReasoningWithTimeout(
        contextText: string,
        queryText: string,
        attachments?: Array<{ type: 'image' | 'file' | 'audio'; data: string; mimeType?: string }>,
        options?: { preferredProvider?: string }
    ): Promise<ReasoningResult> {
        const REASONING_TIMEOUT_MS = 240000;
        let reasoningTimeoutId: ReturnType<typeof setTimeout> | undefined;

        const groundingDirective = `
Agronomic Decision Support Protocol (Phase 2):
1. Location-First & Climate Precision:
   - If this query is an agronomic recommendation (e.g., planting dates, crop selection, pest treatment) and NO explicit location/growing zone is given by the user or context, DO NOT hallucinate or assume an arbitrary state/country.
   - Prompt the user to provide their county/region or USDA / Plant Hardiness Zone for personalized precision.
   - Present a structured climate-band comparison (Cool Zones 3–4, Temperate Zones 5–7, Warm/Subtropical Zones 8–10, or Tropical Wet/Dry) so the answer is immediately usable without false assumptions.
2. Temporal & Soil Temperature Triggers:
   - Avoid vague seasonal terms like "Spring" without qualification.
   - Always state timing relative to the last expected frost date, indoor seed starting lead times (weeks before frost), and minimum 4-inch soil temperature (°F / °C) required for germination.
3. Cultivars & Performance:
   - Recommend tested crop cultivars with Days to Maturity (DTM) and known disease resistance packages.
4. Economic Optimization:
   - Include succession planting, relay cropping, and soil management considerations (e.g. pH, drainage, cover cropping).
5. Grounding & Authority:
   - Prioritize high-similarity context sources (score 0.70+). Cite recognized extension bulletins (Land-Grant universities, FAO, USDA NRCS) and encourage verifying with local extension officers.
6. Multilingual Fluency:
   - Always respond fluently in the exact same language used in the question (e.g. Kiswahili, Français, Español, Português, Hausa, Yoruba, Arabic, etc.) with accurate localized agronomic terminology.
`;

        return Promise.race([
            AIRouter.routeRequest('reason', {
                context: `${contextText || 'No specific context found in knowledge base.'}\n\n${groundingDirective}`,
                query: queryText,
                attachments,
                options: { temperature: 0.2, maxTokens: 1200, preferredProvider: options?.preferredProvider }
            }),
            new Promise<ReasoningResult>((_, reject) => {
                reasoningTimeoutId = setTimeout(
                    () => reject(new Error(`askQuestion reasoning timed out after ${REASONING_TIMEOUT_MS}ms`)),
                    REASONING_TIMEOUT_MS
                );
            }),
        ]).finally(() => clearTimeout(reasoningTimeoutId));
    }

    private static async callReasoningAgentic(
        contextText: string,
        queryText: string,
        attachments: Array<{ type: 'image' | 'file' | 'audio'; data: string; mimeType?: string }> | undefined,
        options: { preferredProvider?: string } | undefined,
        queryCategories: string[]
    ): Promise<ReasoningResult> {
        if (process.env.KNOWLEDGE_AGENTIC_LOOP === 'false') {
            return this.callReasoningWithTimeout(contextText, queryText, attachments, options);
        }
        const toolDefs = mcpAdapter.convertToMCPTools().map(t => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description, parameters: t.inputSchema }
        }));
        if (toolDefs.length === 0) return this.callReasoningWithTimeout(contextText, queryText, attachments, options);

        const systemPrompt = `You are an agricultural research assistant with tools. Use them to gather fresh evidence before answering. Cite sourceUrl for every claim. Current categories: ${queryCategories.join(', ') || 'general'}. Context:\n${contextText || 'No specific context found.'}`;
        const start = Date.now();
        const BUDGET_MS = 40000;
        let messages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }> = [{ role: 'user', content: queryText }];

        for (let turn = 0; turn < 4; turn++) {
            if (Date.now() - start > BUDGET_MS) break;
            const remaining = BUDGET_MS - (Date.now() - start);
            const res = await Promise.race([
                AIRouter.routeRequest('reason', {
                    context: systemPrompt,
                    query: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
                    attachments,
                    options: { temperature: 0.2, maxTokens: 1200, preferredProvider: options?.preferredProvider, tools: toolDefs } as unknown as Record<string, unknown>
                }),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error('agentic turn timeout')), Math.min(12000, remaining)))
            ]) as unknown as (ReasoningResult & { toolCalls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> });
            const toolCalls = (res as unknown as { toolCalls?: Array<{ function: { name: string; arguments: unknown } }> }).toolCalls;
            if (!toolCalls || toolCalls.length === 0) return res;
            // Execute tools with 8s per-tool timeout
            const toolResults: string[] = [];
            for (const tc of toolCalls) {
                try {
                    const result = await Promise.race([
                        mcpAdapter.callTool(tc.function.name, tc.function.arguments as Record<string, unknown>),
                        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`tool ${tc.function.name} timeout 8s`)), 8000))
                    ]) as { content?: Array<{ text?: string }> };
                    toolResults.push(`Tool ${tc.function.name} result: ${result.content?.[0]?.text?.slice(0, 2000) || 'No output'}`);
                } catch (e) { toolResults.push(`Tool ${tc.function.name} error: ${e instanceof Error ? e.message : String(e)}`); }
                if (Date.now() - start > BUDGET_MS) break;
            }
            messages.push({ role: 'assistant', content: (res as ReasoningResult).answer || '', tool_calls: toolCalls as unknown[] });
            messages.push({ role: 'tool', content: toolResults.join('\n') });
            // Check evidence: if last tool results yielded citations, we can break early on next loop
            if (toolResults.join('').length > 500) continue;
        }
        // Final synthesis without tools if loop exhausted
        return AIRouter.routeRequest('reason', {
            context: systemPrompt,
            query: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
            attachments,
            options: { temperature: 0.2, maxTokens: 1200, preferredProvider: options?.preferredProvider }
        }) as Promise<ReasoningResult>;
    }

    private static async postProcessResponse(
        reasoningResult: ReasoningResult,
        queryText: string
    ): Promise<{ visuals: any; audio?: string }> {
        let audioBase64: string | undefined = undefined;
        let enhancedVisuals = reasoningResult.visuals;

        await Promise.all([
            (async () => {
                if (reasoningResult.visuals) {
                    enhancedVisuals = await this.validateAndEnhanceVisuals(reasoningResult.visuals, queryText);
                }
            })(),
            (async () => {
                if (process.env.KNOWLEDGE_TTS_ENABLED !== 'true') return;
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

        return { visuals: enhancedVisuals, audio: audioBase64 };
    }

    /**
     * Ask a question and get a RAG-based answer (with semantic caching and multimodal support)
     */
    private static cacheAndLogResponse(userId: string, queryText: string, attachments: Record<string, any>[] | undefined, redisKey: string, queryCategories: string[], response: Record<string, any>) {
        if (!attachments || attachments.length === 0) {
            cacheSet(redisKey, JSON.stringify(response), 3600 * 24).catch(e => logger.error('Failed to set Redis exact cache:', e));
            SemanticCacheService.save(queryText, response.answer, response.contextUsed, response.visuals).catch(e => logger.error('Failed to save semantic cache:', e));
        }

        this.logSearch(
            userId, queryText, queryCategories[0] || 'general_inquiry', undefined,
            response.answer, response.reasoning, response.visuals
        ).catch(logError => logger.error('Background logging failed:', logError));
    }

    private static handleAskQuestionFallback(userId: string, queryText: string, contextResults: SearchResult[], error: unknown) {
        logger.error('RAG analysis failed:', error);

        if (contextResults.length > 0) {
            const fallback = this.buildExtractiveAnswer(queryText, contextResults);
            this.logSearch(
                userId, queryText,
                contextResults[0]?.metadata?.category as string | undefined, contextResults[0]?.metadata?.crop as string | undefined,
                fallback.answer, fallback.reasoning, fallback.visuals
            ).catch(logError => logger.error('Fallback search logging failed:', logError));
            return fallback;
        }

        const noResultAnswer: ReasoningResult & { cached: boolean; contextUsed: SearchResult[] } = {
            reasoning: 'No context found in knowledge base and AI provider did not complete in time.',
            answer: `I wasn't able to find information about **"${queryText}"** in the knowledge base, and the AI assistant is currently unavailable. Please try rephrasing your question or check back later.`,
            confidence: 0.1,
            visuals: {
                kpis: [
                    { label: 'Source Matches', value: '0', status: 'warning' as const },
                    { label: 'Status', value: 'No Results', status: 'warning' as const }
                ],
                charts: [],
                images: [],
                videos: []
            },
            contextUsed: [],
            cached: false
        };

        this.logSearch(
            userId, queryText, 'general_inquiry', undefined,
            noResultAnswer.answer, noResultAnswer.reasoning, noResultAnswer.visuals
        ).catch(logError => logger.error('Fallback search logging failed:', logError));

        return noResultAnswer;
    }

    static async askQuestion(
        userId: string,
        queryText: string,
        attachments?: Array<{ type: 'image' | 'file' | 'audio'; data: string; mimeType?: string }>,
        options?: { preferredProvider?: string }
    ): Promise<ReasoningResult & { cached: boolean; contextUsed: SearchResult[] }> {
        logger.info(`Getting RAG-based answer for query: "${queryText}" (User: ${userId}, Attachments: ${attachments?.length || 0}, PreferredProvider: ${options?.preferredProvider || 'default'})`);

        const queryCategories = await this.categorizeQuery(queryText, options);
        const isRealTimeIntent = queryCategories.some(c => ['market_and_commodity_prices', 'climate_and_weather', 'market_prices'].includes(c));
        const freshSuffix = isRealTimeIntent ? `:fresh:${new Date().toISOString().slice(0, 10)}` : '';
        const redisKey = `rag:exact:${queryText.toLowerCase().trim()}${freshSuffix}`;

        if (!attachments || attachments.length === 0) {
            // Bypass semantic cache for real-time intents (market/weather) to avoid stale 24h answers
            if (isRealTimeIntent) {
                const exactHit = await this.checkExactCachesOnly(queryText, redisKey);
                if (exactHit) return exactHit;
            } else {
                const cached = await this.checkCaches(queryText, redisKey);
                if (cached) return cached;
            }
        }

        let contextResults = await this.searchKnowledge(queryText);
        const isAgriQuery = queryCategories.length === 0 || queryCategories.some(c =>
            ['pest_and_disease', 'agronomy_and_yield', 'climate_and_weather', 'market_prices'].includes(c)
        );

        contextResults = await this.enrichContextWithWebFallbacks(queryText, queryCategories, isAgriQuery, contextResults);

        const userContext = await this.resolveUserContext(userId, queryText);

        if (isAgriQuery) {
            const liveResults = await this.fetchLiveAgriContext(queryCategories, userContext);
            contextResults = [...liveResults, ...contextResults];
        }

        const contextText = contextResults
            .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}] (Type: ${res.metadata.contentType || 'text'}, Score: ${res.score !== undefined ? res.score.toFixed(2) : '1.0'}, URL: ${res.metadata.sourceUrl || ''})\n${res.content}`)
            .join('\n\n---\n\n');

        try {
            const reasoningResult = process.env.KNOWLEDGE_AGENTIC_LOOP === 'false'
                ? await this.callReasoningWithTimeout(contextText, queryText, attachments, options)
                : await this.callReasoningAgentic(contextText, queryText, attachments, options, queryCategories);
            const { visuals, audio } = await this.postProcessResponse(reasoningResult, queryText);

            const response = {
                ...reasoningResult,
                visuals,
                audio,
                contextUsed: contextResults,
                cached: false
            };

            this.cacheAndLogResponse(userId, queryText, attachments, redisKey, queryCategories, response);

            return response;
        } catch (error) {
            return this.handleAskQuestionFallback(userId, queryText, contextResults, error);
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
     * Wrapped in a 10-second timeout so a slow AI provider doesn't block the RAG pipeline.
     */
    static async categorizeQuery(queryText: string, options?: { preferredProvider?: string }): Promise<string[]> {
        const TIMEOUT_MS = 10000;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            const classification = await Promise.race([
                AIRouter.routeRequest('classify', {
                    input: queryText,
                    options: {
                        taxonomy: 'pest_and_disease, agronomy_and_yield, climate_and_weather, market_prices, general_inquiry',
                        multiLabel: true,
                        preferredProvider: options?.preferredProvider
                    }
                }),
                new Promise<Record<string, any>>((_, reject) => {
                    timeoutId = setTimeout(
                        () => reject(new Error(`categorizeQuery timed out after ${TIMEOUT_MS}ms`)),
                        TIMEOUT_MS
                    );
                }),
            ]).finally(() => clearTimeout(timeoutId));

            return classification.labels
                .filter((l: Record<string, any>) => l.score > 0.4)
                .map((l: Record<string, any>) => l.label);
        } catch (error) {
            const isTimeout = (error as Error).message?.includes('categorizeQuery timed out');
            if (isTimeout) {
                logger.warn(`categorizeQuery timeout for: "${queryText.substring(0, 80)}" — falling back to general_inquiry`);
            } else {
                logger.error('categorizeQuery failed:', error);
            }
            return ['general_inquiry'];
        }
    }

    private static async enhanceImages(enhancedVisuals: Record<string, any>, searchQuery: string) {
        if (!enhancedVisuals.images || enhancedVisuals.images.length === 0) return;

        const validImageUrls = await AssetValidationService.validateAssetUrls(
            enhancedVisuals.images.map((img: Record<string, any>) => img.url)
        );

        enhancedVisuals.images = enhancedVisuals.images.filter((img: Record<string, any>) =>
            validImageUrls.includes(img.url)
        );

        if (enhancedVisuals.images.length < 2) {
            try {
                const additionalImages = await AssetValidationService.getRelevantImages(searchQuery, 3);
                const existingUrls = new Set(enhancedVisuals.images.map((img: Record<string, any>) => img.url));

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

    private static async enhanceVideos(enhancedVisuals: Record<string, any>) {
        if (!enhancedVisuals.videos || enhancedVisuals.videos.length === 0) return;

        const validVideoUrls = await AssetValidationService.validateAssetUrls(
            enhancedVisuals.videos.map((vid: Record<string, any>) => vid.url)
        );

        enhancedVisuals.videos = enhancedVisuals.videos.filter((vid: Record<string, any>) =>
            validVideoUrls.includes(vid.url)
        );
    }

    private static async addFallbackVisuals(enhancedVisuals: Record<string, any>, searchQuery: string) {
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
    }

    /**
     * Validates and enhances visual assets with runtime checks
     */
    static async validateAndEnhanceVisuals(visuals: Record<string, any>, searchQuery: string): Promise<Record<string, any>> {
        const enhancedVisuals = { ...visuals };

        await this.enhanceImages(enhancedVisuals, searchQuery);
        await this.enhanceVideos(enhancedVisuals);
        await this.addFallbackVisuals(enhancedVisuals, searchQuery);

        return enhancedVisuals;
    }
}
