/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { VectorService, SearchResult } from '@/services/vectorService';
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
    static async searchKnowledge(query: string, limit: number = 3): Promise<SearchResult[]> {
        return VectorService.search(query, limit);
    }

    /**
     * Ask a question and get a RAG-based answer
     */
    static async askQuestion(query: string): Promise<{ answer: string; contextUsed: SearchResult[] }> {
        logger.info(`Getting RAG-based answer for query: "${query}"`);

        // 1. Retrieve relevant context
        const contextResults = await this.searchKnowledge(query);
        const contextText = contextResults
            .map(res => `[Source: ${res.metadata.crop}/${res.metadata.category}]\n${res.content}`)
            .join('\n\n---\n\n');

        // 2. Generate answer using Reasoning capability of ALFA
        try {
            const reasoningResult = await AIRouter.routeRequest('reason', {
                context: contextText || 'No specific context found in knowledge base.',
                query: query,
                options: { temperature: 0.2 }
            });

            return {
                answer: reasoningResult.answer,
                contextUsed: contextResults
            };
        } catch (error) {
            logger.error('RAG analysis failed:', error);
            throw error;
        }
    }

    /**
     * Categorize a query to optimize retrieval
     */
    static async categorizeQuery(query: string): Promise<string[]> {
        try {
            const classification = await AIRouter.routeRequest('classify', {
                input: query,
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
