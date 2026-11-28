import { Router, type Request, type Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { listDemoVisits } from '@/services/demoVisits';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';

/**
 * GET /demo-visits?days=30 (admins): recent demo visits with their approximate place and
 * shortened IP, and visits per country. Places from the DB-IP Lite database need the
 * attribution "IP Geolocation by DB-IP" (https://db-ip.com) where they are shown.
 */
const router = Router();

/** The `days` asked for, as whole days from 1 to 90 (30 when missing or not a number). */
export function demoVisitDays(value: unknown): number {
  const days = value === undefined || value === '' ? NaN : Math.floor(Number(value));
  return Number.isFinite(days) ? Math.min(Math.max(days, 1), 90) : 30;
}

router.get('/', authorize(['admin']), async (req: Request, res: Response) => {
  // Whole days only (the query counts days in an interval): 2.5 becomes 2.
  const days = demoVisitDays(req.query.days);
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, days, ...(await listDemoVisits(days)) });
  } catch (error) {
    logger.error('[demoVisits] Listing failed:', error);
    safeError(res, 500, 'Demo visits could not be loaded');
  }
});

export default router;
