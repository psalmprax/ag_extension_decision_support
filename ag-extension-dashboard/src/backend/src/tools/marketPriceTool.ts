import { z } from 'zod';
import { Tool } from './types';
import { marketPriceService } from '@/services/marketPriceService';
import { logger } from '@/utils/logger';

// Define the schema for market prices tool
const MarketPriceSchema = z.object({
  crop: z.string().optional().describe('Filter by specific crop name (e.g., "Maize")'),
});

/**
 * A tool that fetches the latest agricultural market prices from the internal "Real-First" database.
 */
export const marketPriceTool: Tool<typeof MarketPriceSchema> = {
  name: 'get_market_prices',
  description: 'Fetches the latest agricultural market prices for various crops. Use this to provide accurate financial advice to farmers and extension officers.',
  schema: MarketPriceSchema,
  execute: async ({ crop }) => {
    logger.info(`AI Advisor fetching market prices${crop ? ` for ${crop}` : ''}`);

    try {
      const prices = await marketPriceService.getLatestPrices();
      
      let filteredPrices = prices;
      if (crop) {
        const lowerCrop = crop.toLowerCase();
        filteredPrices = prices.filter(p => p.crop.toLowerCase().includes(lowerCrop));
      }

      if (filteredPrices.length === 0) {
        return `No current market price data found${crop ? ` for "${crop}"` : ''}. The data might still be synchronizing.`;
      }

      return JSON.stringify({
        success: true,
        data: filteredPrices,
        message: 'Latest market price data retrieved from the system.'
      });
    } catch (error) {
      logger.error('Error in marketPriceTool:', error);
      return JSON.stringify({
        success: false,
        message: 'Failed to retrieve market prices from the internal database.'
      });
    }
  },
};
