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
  description: 'Fetches the latest agricultural market prices for various crops. Each row carries a dataStatus (live vs. estimated); only quote live rows as market facts to farmers and extension officers.',
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

      const statuses = new Set(filteredPrices.map(p => (p as { dataStatus?: string }).dataStatus || 'unknown'));
      const allEstimated = filteredPrices.every(p => (p as { dataStatus?: string }).dataStatus === 'estimated');
      const message = allEstimated
        ? 'WARNING: all returned prices are static baseline estimates (live FAOSTAT/GIEWS data unavailable). Tell the user these are indicative only.'
        : statuses.has('estimated')
          ? 'Mixed data: some rows are live market data, others are baseline estimates — check each row\'s dataStatus before quoting.'
          : 'Live market price data retrieved.';
      return JSON.stringify({
        success: true,
        dataStatuses: Array.from(statuses),
        data: filteredPrices,
        message,
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
