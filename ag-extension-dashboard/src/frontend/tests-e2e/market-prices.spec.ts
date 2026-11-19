import { expect, test } from '@playwright/test';

/**
 * The landing price card is public and quotes FAOSTAT producer prices in USD.
 * FAOSTAT is an annual series with a publication lag, so an empty `prices`
 * array is a legitimate answer (`dataStatus: 'unavailable'`); what must never
 * happen is a different country's prices or a non-USD quote being served.
 */
test.describe('landing market prices', () => {
  test('serves Kenya producer prices in USD with FAOSTAT attribution', async ({ request }) => {
    const res = await request.get('/api/public/market-prices?country=Kenya');

    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: {
        country: string;
        currency: string;
        attribution: string;
        dataStatus: 'live' | 'unavailable';
        prices: Array<{ priceType: string; usdPerTonne: number; usdPerBag90kg: number }>;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.country).toBe('Kenya');
    expect(body.data.currency).toBe('USD');
    expect(body.data.attribution).toContain('FAOSTAT');
    expect(Array.isArray(body.data.prices)).toBe(true);

    for (const price of body.data.prices) {
      expect(price.priceType).toBe('producer');
      expect(price.usdPerTonne).toBeGreaterThan(0);
      expect(price.usdPerBag90kg).toBeGreaterThan(0);
    }
  });

  test('refuses a country with no configured feed instead of substituting Kenya', async ({ request }) => {
    const res = await request.get('/api/public/market-prices?country=Atlantis');

    expect(res.status()).toBe(400);
    const body = (await res.json()) as { success: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('Atlantis');
  });
});
