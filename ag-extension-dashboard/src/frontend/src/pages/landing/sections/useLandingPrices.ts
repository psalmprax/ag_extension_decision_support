import { useEffect, useState } from 'react';

export interface LandingPrice {
  crop: string;
  cropCode: string;
  usdPerTonne: number;
  usdPerKg: number;
  usdPerBag90kg: number;
  yoyPct: number | null;
}

export interface LandingPricesSnapshot {
  prices: LandingPrice[];
  period: string | null;
  attribution: string;
}

/** Country the public card quotes. */
const LANDING_PRICE_COUNTRY = 'Kenya';

/**
 * FAOSTAT annual producer prices, fetched once on mount. Any failure keeps the
 * caller at null so the sample preview stays, still labelled as sample data.
 */
export function useLandingPrices(): LandingPricesSnapshot | null {
  const [snapshot, setSnapshot] = useState<LandingPricesSnapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/market-prices?country=${encodeURIComponent(LANDING_PRICE_COUNTRY)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))
      )
      .then((body: {
        success?: boolean;
        data?: {
          prices?: LandingPrice[];
          period?: string | null;
          dataStatus?: string;
          attribution?: string;
        };
      }) => {
        // Only real, non-empty data may replace the sample preview.
        if (!body.success || !body.data || body.data.dataStatus !== 'live' || !body.data.prices?.length) {
          return;
        }
        setSnapshot({
          prices: body.data.prices,
          period: body.data.period ?? null,
          attribution: body.data.attribution ?? 'FAOSTAT Producer Prices (CC BY 4.0)',
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('Landing producer prices unavailable; keeping the sample preview.', error);
      });
    return () => controller.abort();
  }, []);

  return snapshot;
}
