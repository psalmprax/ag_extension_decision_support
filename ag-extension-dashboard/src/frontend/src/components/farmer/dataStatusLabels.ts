import type { MarketDataStatus } from '@/api/priceService';

/** How each data source's status reads on the farmer's cards. */
export const DATA_STATUS_LABELS: Record<MarketDataStatus, string> = {
  live: 'Live',
  estimated: 'Estimated',
  unavailable: 'Unavailable',
};
