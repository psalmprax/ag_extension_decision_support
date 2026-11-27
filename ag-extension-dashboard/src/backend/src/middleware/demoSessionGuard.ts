import { NextFunction, Request, Response } from 'express';
import { viewerIsDemo } from '@/services/demoScope';

/**
 * The public demo session ("Try the Demo") is read-only and limited to demo
 * records. It may call only the endpoints the demo UI uses (taken from a crawl
 * of every demo page): its own account, reference data, demo-scoped records,
 * signing in and out, and the public assistant. Everything else is refused, so
 * a route nobody listed can never show the demo real data or change anything.
 *
 * Endpoints are written without the /api or /api/v1 prefix.
 */
export const DEMO_READS: ReadonlySet<string> = new Set([
  '/auth/me',
  '/advisories/recent', // empty for the demo
  '/ai/diseases', // disease catalogue
  '/ai/reviews', // empty for the demo
  '/billing/invoices',
  '/billing/payment-methods',
  '/billing/plans',
  '/billing/quotas',
  '/billing/subscription',
  '/billing/transaction/my',
  '/campaigns/outreach-stats', // demo-linked messages only
  '/efficacy/followups', // the demo officer's own queue
  '/efficacy/summary',
  '/external/recent-weather',
  '/external/weather',
  '/knowledge/quota',
  '/knowledge/stats',
  '/knowledge/search', // public knowledge base
  '/notifications', // the demo user's own notifications
  '/notifications/unread-count',
  '/notifications/vapid-public-key', // public: the push key the browser subscribes with
  '/outbreaks', // demo-linked diagnoses only
  '/worldmonitor/layers', // demo farmers only
]);

export const DEMO_WRITES: ReadonlySet<string> = new Set([
  '/auth/demo',
  '/errors', // browser crash reports: public, write-only, about the page not the account
  '/auth/refresh',
  '/auth/logout',
  '/chatbot/public-demo', // the landing-page assistant, public anyway
  '/chatbot/public-demo/stt',
  '/chatbot/public-demo/tts',
  '/knowledge/ask', // knowledge-base answers, with the demo's daily quota
]);

/**
 * The ways out of the demo: signing in, signing up, recovering a password. They are
 * public (anyone signed out may call them) and act on no account of the session's own,
 * so allowing them shows or changes nothing of the demo's,
 * and refusing them meant a visitor still holding a demo session could not sign in
 * to their own account without signing out of the demo first.
 */
export const LEAVING_THE_DEMO: ReadonlySet<string> = new Set([
  '/auth/login',
  '/auth/mfa/verify', // the second step of signing in
  '/auth/phone/request',
  '/auth/phone/verify',
  '/auth/register',
  '/auth/register/challenge',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  // Not /auth/resend-verification: it acts on the signed-in account (the demo's own).
]);

const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * "/api/v1/farmers/" → "/farmers"; null for anything outside /api. Express
 * matches routes case-insensitively, so "/API/V1/Farmers" must not slip past.
 */
export function apiEndpoint(path: string): string | null {
  const normalised = path.replace(/\/{2,}/g, '/').toLowerCase();
  const match = /^\/api(?:\/v1)?(\/.*)?$/.exec(normalised);
  if (!match) return null;
  const endpoint = (match[1] || '/').replace(/\/+$/, '');
  return endpoint || '/';
}

export function demoSessionGuard(req: Request, res: Response, next: NextFunction): void {
  if (!viewerIsDemo(req.user) || req.method === 'OPTIONS') return next();
  const endpoint = apiEndpoint(req.path);
  if (endpoint === null || LEAVING_THE_DEMO.has(endpoint)) return next();

  const allowed = READ_METHODS.has(req.method) ? DEMO_READS : DEMO_WRITES;
  if (allowed.has(endpoint)) return next();

  res.status(403).json({
    success: false,
    error: 'This is not available in the demo. Create an account to use it with your own farmers.',
    code: 'DEMO_READ_ONLY',
  });
}
