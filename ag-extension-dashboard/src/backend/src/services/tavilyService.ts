/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

export interface TavilySearchResponse {
    results: TavilySearchResult[];
    answer: string;
}

class TavilyService {
    private apiKey: string;
    private baseUrl = 'https://api.tavily.com/search';

    constructor() {
        this.apiKey = config.externalApis.tavily?.apiKey || process.env.TAVILY_API_KEY || '';
    }

    async search(query: string, numResults = 5): Promise<TavilySearchResponse | null> {
        if (!this.apiKey) {
            logger.warn('Tavily API key not configured, skipping web search');
            return null;
        }

        try {
            const response = await axios.post(
                this.baseUrl,
                {
                    query,
                    num_results: numResults,
                    include_answer: true,
                    include_raw_content: false,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                    timeout: 10000,
                }
            );

            return {
                results: response.data.results?.map((r: any) => ({
                    title: r.title,
                    url: r.url,
                    content: r.content,
                    score: r.score,
                })) || [],
                answer: response.data.answer || '',
            };
        } catch (error) {
            logger.error('Tavily search error:', error);
            return null;
        }
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }
}

export const tavilyService = new TavilyService();