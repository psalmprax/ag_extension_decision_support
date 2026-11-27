import type { NextFunction, Request, Response } from 'express';
import { recordFailure } from '@/services/failureMonitor';

/** Paths whose failures say nothing about the app: probes, the browser error reports, and the monitoring endpoint itself. */
const SKIPPED = [/^\/api(\/v1)?\/health\b/, /^\/api(\/v1)?\/errors\b/, /^\/api(\/v1)?\/monitoring\b/];

/**
 * Counts every /api response with status 400 or more (except 401) by route and status,
 * with the error text it sent, for the hourly "errors in production" check. Responses are
 * unchanged: the JSON body is only read, to keep its `error` text as a sample.
 */
export function failureRecorder(req: Request, res: Response, next: NextFunction): void {
  const path = req.originalUrl;
  if (!path.startsWith('/api') || SKIPPED.some(pattern => pattern.test(path))) {
    next();
    return;
  }
  let sample: string | undefined;
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      sample = body.error;
    }
    return json(body);
  };
  res.on('finish', () => {
    if (res.statusCode >= 400) void recordFailure('server', req.method, path, res.statusCode, sample);
  });
  next();
}
