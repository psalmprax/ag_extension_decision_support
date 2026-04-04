import { z } from 'zod';
import { Tool } from './types';
import { tavilyService } from '@/services/tavilyService';
import { logger } from '@/utils/logger';

// Define the schema for research tool
const ResearchSchema = z.object({
  query: z.string().describe('The agricultural query or research topic (e.g., "Effective fall armyworm control in maize")'),
  deepSearch: z.boolean().optional().default(false).describe('Whether to perform a more extensive search'),
});

/**
 * A tool that performs deep agricultural research using the Tavily API to get up-to-the-minute expert advice.
 */
export const researchTool: Tool<typeof ResearchSchema> = {
  name: 'research_agricultural_data',
  description: 'Performs a real-time web search for deep agricultural knowledge, recent research, pest outbreaks, or market trends. Use this when the initial advice needs validation or when looking for very specific technical data.',
  schema: ResearchSchema,
  execute: async ({ query, deepSearch }) => {
    logger.info(`AI Advisor performing research for: ${query} (DeepSearch: ${deepSearch})`);

    try {
      const result = await tavilyService.search(query, deepSearch ? 10 : 5);
      
      if (!result || result.results.length === 0) {
        return `No current research results found for "${query}". Recommending standard extension practices instead.`;
      }

      // Return a concise summary of the results
      const summary = result.results.map((r, i) => `${i+1}. ${r.title}\nURL: ${r.url}\nContent summary: ${r.content.substring(0, 300)}...`).join('\n\n');

      return JSON.stringify({
        success: true,
        answer: result.answer,
        findings: summary,
        message: 'Real-time research completed successfully.'
      });
    } catch (error) {
      logger.error('Error in researchTool:', error);
      return JSON.stringify({
        success: false,
        message: 'External research access interrupted. Falling back to internal knowledge base.'
      });
    }
  },
};
