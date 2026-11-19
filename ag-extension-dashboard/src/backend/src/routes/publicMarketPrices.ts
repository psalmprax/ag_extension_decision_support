import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { isPriceCountrySupported, marketPriceService } from '@/services/marketPriceService';

const router = Router();

const DEFAULT_COUNTRY = 'Kenya';
const ATTRIBUTION = 'FAOSTAT Producer Prices (CC BY 4.0)';

/**
 * Public landing-page producer prices. No authentication: the figures are
 * national annual statistics, and the app-wide limiter applies.
 *
 * Unknown countries answer 400 rather than silently substituting Kenya — a
 * wrong country's prices on a price card is worse than no card.
 */
router.get('/', async (req: Request, res: Response) => {
    const requested = typeof req.query.country === 'string' ? req.query.country.trim() : '';
    const country = requested || DEFAULT_COUNTRY;

    if (!isPriceCountrySupported(country)) {
        res.status(400).json({
            success: false,
            error: `No producer-price feed is configured for ${country}.`,
        });
        return;
    }

    try {
        const snapshot = await marketPriceService.getLandingPrices(country);
        res.json({
            success: true,
            data: {
                country,
                currency: 'USD',
                attribution: ATTRIBUTION,
                ...snapshot,
            },
        });
    } catch (error) {
        logger.error(`Public market prices failed for ${country}:`, error);
        safeError(res, 500, 'Market prices are temporarily unavailable');
    }
});

export default router;
