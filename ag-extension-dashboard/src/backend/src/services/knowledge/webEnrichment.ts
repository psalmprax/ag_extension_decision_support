/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SearchResult } from '@/services/vectorService';
import { logger } from '@/utils/logger';
import { tavilyService } from '@/services/tavilyService';
import { StealthScraperService } from '@/services/stealthScraperService';
import { isAgronomicContent, prepareWebSearchQuery } from '@/utils/agronomicQueryNormalizer';

/**
 * External web enrichment: fresh Tavily retrieval with Jina fallback for
 * sparse snippets, plus an agri-scraper fallback. Non-agronomic results
 * are discarded before entering RAG context.
 */

export async function fallbackAgriQuery(queryText: string, queryCategories: string[], currentResults: SearchResult[]): Promise<SearchResult[]> {
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
                setTimeout(() => reject(new Error('StealthScraperService.scrapeKnowledge timed out after 5s')), 5000)
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

export async function fetchViaJina(url: string): Promise<string | null> {
    try {
        const jinaUrl = `https://r.jina.ai/${url}`;
        const { default: axios } = await import('axios');
        const resp = await axios.get(jinaUrl, { timeout: 2500, headers: { 'Accept': 'text/markdown' } });
        const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        return text.slice(0, 4000);
    } catch { return null; }
}

export async function enrichContextWithWebFallbacks(
    queryText: string,
    queryCategories: string[],
    isAgriQuery: boolean,
    contextResults: SearchResult[]
): Promise<SearchResult[]> {
    const fetchedAt = new Date().toISOString();
    const isRealTimeIntent = queryCategories.some(c => ['market_and_commodity_prices', 'climate_and_weather'].includes(c));

    // Always attempt fresh web retrieval for real-time intents or when local score is weak (< 0.78)
    const needsFreshWeb = isRealTimeIntent || contextResults.length === 0 || (contextResults[0].score !== undefined && contextResults[0].score < 0.78);
    if (!needsFreshWeb && !isRealTimeIntent) {
        // Attach fetchedAt to existing results for citation freshness
        return contextResults.map(r => ({
            ...r,
            metadata: { ...r.metadata, fetchedAt: (r.metadata as Record<string, unknown>).fetchedAt || fetchedAt } as SearchResult['metadata'],
        }));
    }

    logger.info(`Enriching context with Tavily (4, basic, week) for: "${queryText}" (realTime=${isRealTimeIntent})`);
    let webResults = await fetchTavilyWebResults(queryText, fetchedAt);

    // Fallback to agri-specific scraper only if Tavily yielded nothing and is agri query
    if (webResults.length === 0 && isAgriQuery) {
        webResults = await fallbackAgriQuery(queryText, queryCategories, []);
    }

    return dedupeAndRerank(queryText, [...webResults, ...contextResults], fetchedAt);
}

/** Fetch up to 4 fresh Tavily results, enriching with Jina only if snippet is sparse. Discards non-agronomic web results. */
export async function fetchTavilyWebResults(queryText: string, fetchedAt: string): Promise<SearchResult[]> {
    try {
        const webSearchQuery = prepareWebSearchQuery(queryText);
        const tavilyRes = await tavilyService.search(webSearchQuery, 4, { searchDepth: 'basic', timeRange: 'week', includeAnswer: false });
        if (!tavilyRes?.results?.length) return [];

        const rawWebResults = await Promise.all(tavilyRes.results.slice(0, 4).map(async (r, idx) => {
            let content = r.content;
            if (!content || content.length < 120) {
                const jinaContent = await fetchViaJina(r.url);
                if (jinaContent) content = jinaContent;
            }
            const combinedText = `${r.title || ''} ${content || ''}`;
            // Guardrail: verify agricultural relevance before ingesting into RAG context
            if (!isAgronomicContent(combinedText)) {
                logger.warn(`Dropping non-agronomic web result from Tavily: "${r.title}" (${r.url})`);
                return null;
            }
            return {
                id: `web-${idx}-${Date.now()}`,
                content: content || r.title,
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

        return rawWebResults.filter((r): r is SearchResult => r !== null);
    } catch (e) {
        logger.warn('Tavily/Jina enrichment failed, continuing with local:', e);
        return [];
    }
}

/** Deduplicate by sourceUrl/content prefix keeping the highest score, then rerank to the top 4 via RAGv2 when available. */
export async function dedupeAndRerank(queryText: string, combined: SearchResult[], fetchedAt: string): Promise<SearchResult[]> {
    const seen = new Map<string, SearchResult>();
    for (const r of combined) {
        const key = (r.metadata?.sourceUrl as string) || r.content.slice(0, 200);
        const existing = seen.get(key);
        if (!existing || (r.score || 0) > (existing.score || 0)) seen.set(key, { ...r, metadata: { ...r.metadata, fetchedAt: (r.metadata as Record<string, unknown>).fetchedAt || fetchedAt } as SearchResult['metadata'] });
    }
    const merged = Array.from(seen.values());
    if (merged.length <= 1) return merged.slice(0, 4);

    // Rerank candidates → top 4 using RAGv2 reranker when available
    const ranked = await rerankWithRagV2(queryText, merged, fetchedAt);
    if (ranked) return ranked;
    return merged.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4);
}

/** RAGv2 rerank attempt; null signals the reranker is unavailable so callers fall back to score ordering. */
export async function rerankWithRagV2(queryText: string, merged: SearchResult[], fetchedAt: string): Promise<SearchResult[] | null> {
    try {
        const { RAGV2Service } = await import('@/services/ragV2Service');
        const ranked = await RAGV2Service.rerank(queryText, merged.map(m => ({
            id: m.id, articleId: m.id, content: m.content, metadata: m.metadata as Record<string, unknown>, score: m.score || 0.5, citation: (m.metadata?.title as string) || ''
        })), 4);
        return ranked.map(rr => ({
            id: rr.id, content: rr.content, metadata: { ...rr.metadata, fetchedAt: (rr.metadata as Record<string, unknown>).fetchedAt || fetchedAt } as SearchResult['metadata'], score: rr.rerankScore ?? rr.score
        }));
    } catch {
        return null;
    }
}
