import { Router, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { SharedStateStore } from '@/middleware/rateLimitMiddleware';
import { recordFailure, routePattern, withoutPersonalData } from '@/services/failureMonitor';
import { logger } from '@/utils/logger';

/**
 * POST /api/errors: crashes and uncaught errors reported by the browser (the error
 * boundary, window errors, unhandled promise rejections). Public and write-only: it
 * stores a count per page and error for the hourly errors-in-production check, logs a
 * shortened line, and forwards each report to Sentry with its stack when SENTRY_DSN is
 * set. Answers 204 to anything.
 */
const router = Router();

const limiter = rateLimit({
  store: new SharedStateStore('rl:client-errors:'),
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? ''),
  handler: (_req: Request, res: Response) => {
    res.status(204).end();
  },
});

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : undefined;

/** The page path of a reported URL, ids replaced, query and fragment dropped. */
export function pageOf(url: unknown): string {
  const raw = text(url, 500);
  if (!raw) return '(unknown page)';
  try {
    return routePattern(new URL(raw, 'https://app.invalid').pathname);
  } catch {
    return '(unknown page)';
  }
}

const scrubbed = (value: string | undefined) => (value ? withoutPersonalData(value) : undefined);

/** Where a browser error came from; anything else is counted as a window error. */
const SOURCES = new Set(['boundary', 'window', 'promise']);

router.post('/', limiter, (req: Request, res: Response) => {
  const body: Record<string, unknown> = req.body && typeof req.body === 'object' ? req.body : {};
  const error: Record<string, unknown> = body.error && typeof body.error === 'object' ? (body.error as Record<string, unknown>) : {};
  const given = text(body.source, 20);
  const source = given && SOURCES.has(given) ? given : body.componentStack ? 'boundary' : 'window';
  const name = text(error.name, 80) ?? 'Error';
  const message = withoutPersonalData(text(error.message, 300) ?? 'Unknown error');
  const page = pageOf(body.url);

  void recordFailure('browser', source, page, 0, `${name}: ${message}`);
  logger.warn('[client-error]', { source, page, name, message, component: text(body.componentName, 80) });

  // The browser sends no Sentry code of its own (it would add about 0.5 MB): its errors reach
  // Sentry from here, with their stacks. Does nothing when SENTRY_DSN is not set.
  // A report without a message (malformed, or a probe) is counted but not sent on.
  if (text(error.message, 300)) {
    Sentry.captureMessage(`${name}: ${message}`, {
      level: 'error',
      tags: { source: `browser-${source}`, page },
      extra: { componentStack: scrubbed(text(body.componentStack, 4000)), stack: scrubbed(text(error.stack, 4000)) },
    });
  }
  res.status(204).end();
});

export default router;
