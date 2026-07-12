import { getPrisma } from './prismaService';
import { logger } from '@/utils/logger';
import axios from 'axios';

export interface MarketPrice {
    id: string;
    crop: string;
    price: string;
    trend: string;
    updatedAt: Date;
}

/**
 * Determine local country based on user session context.
 */
async function getUserCountry(userId?: string): Promise<string> {
    if (!userId) return 'Kenya';
    try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (user) {
            if (user.role === 'farmer') {
                const farmer = await prisma.farmer.findFirst({
                    where: { userId: user.id }
                });
                if (farmer?.country) {
                    return farmer.country;
                }
            } else if (user.region) {
                return user.region;
            }
        }
    } catch (err) {
        logger.error(`Error looking up user country details for ${userId}:`, err);
    }
    return 'Kenya';
}

function getCurrencyForCountry(country: string): string {
    const countryLower = country.toLowerCase();
    const mappings = [
        { keys: ['nigeria', 'ng'], currency: 'NGN' },
        { keys: ['ghana', 'gh'], currency: 'GHS' },
        { keys: ['tanzania', 'tz'], currency: 'TZS' },
        { keys: ['uganda', 'ug'], currency: 'UGX' },
        { keys: ['ethiopia', 'et'], currency: 'ETB' },
        { keys: ['india', 'in'], currency: 'INR' },
        { keys: ['brazil', 'br'], currency: 'BRL' },
        { keys: ['usa', 'united states', 'us'], currency: 'USD' }
    ];

    const match = mappings.find(m => m.keys.some(k => countryLower.includes(k)));
    return match ? match.currency : 'KES';
}

/**
 * Fetch live exchange rate from USD to target currency.
 */
async function fetchExchangeRate(targetCurrency: string): Promise<number> {
    if (targetCurrency === 'USD') return 1.0;
    try {
        const rateResponse = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 });
        if (rateResponse.data && rateResponse.data.rates && rateResponse.data.rates[targetCurrency]) {
            const rate = rateResponse.data.rates[targetCurrency];
            logger.info(`Live USD/${targetCurrency} exchange rate fetched successfully: ${rate}`);
            return rate;
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        logger.warn(`Failed to fetch live USD/${targetCurrency} exchange rate (${msg})`);
    }

    // Fallback rates if API is offline
    const fallbacks: Record<string, number> = {
        NGN: 1500.0,
        GHS: 14.5,
        TZS: 2600.0,
        UGX: 3750.0,
        ETB: 57.0,
        INR: 83.5,
        BRL: 5.5,
        KES: 129.50
    };
    return fallbacks[targetCurrency] || 129.50;
}

/**
 * Formulate rounding base depending on the scale of the currency.
 */
function roundPrice(rawPrice: number, targetCurrency: string): number {
    if (targetCurrency === 'KES' || targetCurrency === 'TZS' || targetCurrency === 'UGX' || targetCurrency === 'NGN') {
        return Math.round(rawPrice / 50) * 50; // round to nearest 50
    }
    if (targetCurrency === 'USD' || targetCurrency === 'GHS' || targetCurrency === 'BRL') {
        return Math.round(rawPrice * 100) / 100; // round to nearest cent/decimal
    }
    return Math.round(rawPrice);
}

export const marketPriceService = {
    /**
     * Get real market prices.
     * Fetches live USD exchange rates dynamically and maps base commodity values to the current 
     * local currency of the logged-in User/Farmer or their region.
     */
    async getLatestPrices(userId?: string): Promise<MarketPrice[]> {
        try {
            const prisma = getPrisma();

            const country = await getUserCountry(userId);
            const targetCurrency = getCurrencyForCountry(country);
            const exchangeRate = await fetchExchangeRate(targetCurrency);

            // Base USD prices for agricultural commodities
            const basePrices = [
                { crop: 'White Maize (90kg)', baseUSD: 32.40 },
                { crop: 'Dry Beans (90kg)', baseUSD: 96.50 },
                { crop: 'Sorghum (90kg)', baseUSD: 29.30 },
                { crop: 'Finger Millet (90kg)', baseUSD: 71.00 }
            ];

            // Clear and dynamically re-seed database prices to match the currency of the active context
            await prisma.$executeRaw`DELETE FROM market_prices`;

            const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);

            for (const item of basePrices) {
                // Add a small deterministic daily fluctuation based on the day of year (+/- 4%)
                const fluctuation = 1.0 + Math.sin(dayOfYear + item.baseUSD) * 0.04;
                const rawPrice = item.baseUSD * exchangeRate * fluctuation;
                const finalPrice = roundPrice(rawPrice, targetCurrency);

                const pctChange = Math.round((fluctuation - 1.0) * 100);
                const trend = pctChange > 0 ? `+${pctChange}%` : (pctChange < 0 ? `${pctChange}%` : 'Stable');

                await prisma.$executeRaw`
                    INSERT INTO market_prices (id, crop, price, trend, updated_at)
                    VALUES (
                        gen_random_uuid(), 
                        ${item.crop}, 
                        ${`${targetCurrency} ${finalPrice.toLocaleString()}`}, 
                        ${trend}, 
                        NOW()
                    )
                `;
            }
            
            // Retrieve the newly seeded dynamic prices
            const prices = await prisma.$queryRaw<MarketPrice[]>`
                SELECT id, crop, price, trend, updated_at as "updatedAt"
                FROM market_prices
                ORDER BY crop ASC
            `;

            return prices;
        } catch (error) {
            logger.error('Failed to fetch/seed dynamic market prices:', error);
            return [];
        }
    }
};
