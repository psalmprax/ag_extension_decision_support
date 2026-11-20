/**
 * The content-gap report (services/content/contentGaps): questions answered without a
 * vetted guide, grouped by crop and country. A manager sees their own country's.
 */
import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { countryOfUser } from '@/services/country/countryContext';
import { contentGapReport } from '@/services/content/contentGaps';

const router = Router();

router.get('/content-gaps', authorize(['admin', 'regional_manager']), async (req: Request, res: Response) => {
    try {
        const user = req.user as { userId: string; role: string };
        const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
        const country = user.role === 'admin' ? null : await countryOfUser(user.userId);
        return res.json({ success: true, data: { days, groups: await contentGapReport(days, country) } });
    } catch (error) {
        logger.error('Content-gap report failed:', error);
        return safeError(res, 500, 'Could not build the content-gap report');
    }
});

export default router;
