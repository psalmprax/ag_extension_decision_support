import { Router, Request, Response } from 'express';
import { allCountryCoverage } from '@/services/country/countryCoverage';

const router = Router();

/**
 * GET /api/v1/countries — public: every country the product can be used in, with what
 * it can serve there (prices, SMS languages, mobile money) and a support level, so the
 * sign-up form can say plainly what a farmer in that country will and will not get.
 */
router.get('/', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ success: true, data: allCountryCoverage() });
});

export default router;
