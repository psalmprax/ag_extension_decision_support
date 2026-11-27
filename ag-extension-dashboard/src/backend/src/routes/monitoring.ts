import { Router, type Request, type Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { failureSummary } from '@/services/failureMonitor';

/**
 * GET /monitoring/failures?hours=1   failed requests and browser errors per route, most
 *   frequent first, for the hourly error-watch workflow. Needs the x-monitoring-token
 *   header to equal MONITORING_TOKEN; answers 404 while no token is configured.
 */
const router = Router();

export function tokenMatches(given: unknown, expected: string | undefined): boolean {
  if (!expected || expected.length < 16 || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.get('/failures', async (req: Request, res: Response) => {
  const expected = process.env.MONITORING_TOKEN;
  if (!expected) return res.status(404).json({ success: false, error: 'Not found' });
  if (!tokenMatches(req.headers['x-monitoring-token'], expected)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  const hours = Math.min(Math.max(Number(req.query.hours) || 1, 1), 48);
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, hours, generatedAt: new Date().toISOString(), failures: await failureSummary(hours) });
});

export default router;
