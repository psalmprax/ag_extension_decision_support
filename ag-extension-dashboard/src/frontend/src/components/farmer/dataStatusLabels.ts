import type { MarketDataStatus } from '@/api/priceService';

type Translate = (key: string, options?: { defaultValue?: string }) => string;

const LABELS: Record<MarketDataStatus, [key: string, english: string]> = {
  live: ['data_status_live', 'Live'],
  estimated: ['data_status_estimated', 'Estimated'],
  unavailable: ['data_status_unavailable', 'Unavailable'],
};

/** How a data source's status reads on the farmer's cards, in the farmer's language. */
export function dataStatusLabel(t: Translate, status: MarketDataStatus): string {
  const [key, english] = LABELS[status];
  return t(key, { defaultValue: english });
}
