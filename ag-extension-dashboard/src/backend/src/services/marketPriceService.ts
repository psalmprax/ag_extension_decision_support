import { getPrisma } from './prismaService';
import { logger } from '@/utils/logger';
import axios from 'axios';

export type MarketDataStatus = 'estimated' | 'unavailable';

export interface MarketPrice {
    id: string;
    crop: string;
    price: string;
    trend: string;
    updatedAt: Date;
    source: 'baseline_estimate';
    dataStatus: MarketDataStatus;
    fetchedAt: string;
    exchangeRateSource: 'live' | 'fallback';
}

interface ExchangeRateResult {
    rate: number;
    source: 'live' | 'fallback';
}

async function getUserCountry(userId?: string): Promise<string> {
    if (!userId) return 'Kenya';
    try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.role === 'farmer') {
            const farmer = await prisma.farmer.findFirst({ where: { userId: user.id } });
            if (farmer?.country) return farmer.country;
        } else if (user?.region) {
            return user.region;
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
        { keys: ['usa', 'united states', 'us'], currency: 'USD' },
    ];
    const match = mappings.find(mapping => mapping.keys.some(key => countryLower.includes(key)));
    return match?.currency || 'KES';
}

async function fetchExchangeRate(targetCurrency: string): Promise<ExchangeRateResult> {
    if (targetCurrency === 'USD') return { rate: 1, source: 'live' };
    try {
        const response = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 });
        const rate = response.data?.rates?.[targetCurrency];
        if (typeof rate === 'number' && Number.isFinite(rate)) {
            logger.info(`Live USD/${targetCurrency} exchange rate fetched successfully: ${rate}`);
            return { rate, source: 'live' };
        }
    } catch (err: unknown) {
        logger.warn(`Failed to fetch live USD/${targetCurrency} exchange rate: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    const fallbackRates: Record<string, number> = {
        NGN: 1500,
        GHS: 14.5,
        TZS: 2600,
        UGX: 3750,
        ETB: 57,
        INR: 83.5,
        BRL: 5.5,
        KES: 129.5,
    };
    return { rate: fallbackRates[targetCurrency] || 129.5, source: 'fallback' };
}

function roundPrice(rawPrice: number, targetCurrency: string): number {
    if (['KES', 'TZS', 'UGX', 'NGN'].includes(targetCurrency)) return Math.round(rawPrice / 50) * 50;
    if (['USD', 'GHS', 'BRL'].includes(targetCurrency)) return Math.round(rawPrice * 100) / 100;
    return Math.round(rawPrice);
}

export const marketPriceService = {
    async getLatestPrices(userId?: string): Promise<MarketPrice[]> {
        try {
            const country = await getUserCountry(userId);
            const targetCurrency = getCurrencyForCountry(country);
            const exchangeRate = await fetchExchangeRate(targetCurrency);
            const fetchedAt = new Date().toISOString();
            const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
            const basePrices = [
                { crop: 'White Maize (90kg)', baseUSD: 32.4 },
                { crop: 'Dry Beans (90kg)', baseUSD: 96.5 },
                { crop: 'Sorghum (90kg)', baseUSD: 29.3 },
                { crop: 'Finger Millet (90kg)', baseUSD: 71 },
            ];

            return basePrices.map((item, index) => {
                const fluctuation = 1 + Math.sin(dayOfYear + item.baseUSD) * 0.04;
                const finalPrice = roundPrice(item.baseUSD * exchangeRate.rate * fluctuation, targetCurrency);
                const percentageChange = Math.round((fluctuation - 1) * 100);
                const trend = percentageChange > 0 ? `+${percentageChange}%` : percentageChange < 0 ? `${percentageChange}%` : 'Stable';
                return {
                    id: `baseline-${targetCurrency.toLowerCase()}-${index + 1}`,
                    crop: item.crop,
                    price: `${targetCurrency} ${finalPrice.toLocaleString()}`,
                    trend,
                    updatedAt: new Date(fetchedAt),
                    source: 'baseline_estimate' as const,
                    dataStatus: 'estimated' as const,
                    fetchedAt,
                    exchangeRateSource: exchangeRate.source,
                };
            });
        } catch (error) {
            logger.error('Failed to calculate market price estimates:', error);
            return [];
        }
    },
};
