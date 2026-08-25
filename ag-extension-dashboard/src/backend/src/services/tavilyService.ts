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

/** Raw result object returned by the Tavily API. */
interface TavilyRawResult {
    title?: unknown;
    url?: unknown;
    content?: unknown;
    score?: unknown;
}

const toString = (value: unknown): string => (typeof value === 'string' ? value : '');
const toNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);

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

            const rawResults: TavilyRawResult[] = Array.isArray(response.data.results) ? response.data.results : [];
            return {
                results: rawResults.map((r) => ({
                    title: toString(r.title),
                    url: toString(r.url),
                    content: toString(r.content),
                    score: toNumber(r.score),
                })),
                answer: typeof response.data.answer === 'string' ? response.data.answer : '',
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