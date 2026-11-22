import type { Request } from 'express';

/**
 * The caller's address as the trusted proxy reports it. `req.ip` already applies the
 * `trust proxy` hop count set in app.ts; the raw X-Forwarded-For header is whatever the
 * client chose to send, so login history and sessions never read it directly.
 */
export function clientIpOf(req: Request): string | null {
    return req.ip || null;
}
