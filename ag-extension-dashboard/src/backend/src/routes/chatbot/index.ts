import { NextFunction, Request, Response, Router } from 'express';
import conversationsRouter from './conversations';
import messagesRouter from './messages';
import completionsRouter from './completions';
import publicDemoRouter from './publicDemo';
import importSessionRouter from './importSession';
import turnTakingRouter from './turnTaking';
import { aiRateLimiter } from '@/middleware/rateLimitMiddleware';

const router = Router();

/**
 * Routes that call an AI provider: completions, the public demo, and Ask AI in
 * a thread. Only these use the dedicated (smaller) AI bucket.
 */
export function isAiGenerationRoute(req: Pick<Request, 'method' | 'path'>): boolean {
  if (req.method !== 'POST') return false;
  return req.path === '/completions'
    || req.path === '/public-demo'
    || req.path.startsWith('/public-demo/')
    || /^\/conversations\/[^/]+\/ask-ai$/.test(req.path);
}

// Generation routes pass through the AI bucket before their own auth/usage
// middleware. Everything else — reading threads and plain messages between a
// farmer and their officer — stays on the general per-user limiter only. It
// used to share the 60-per-5-minutes AI bucket, so an officer working through
// their conversations was refused (429) mid-reply and the message was lost.
router.use((req: Request, res: Response, next: NextFunction) =>
  (isAiGenerationRoute(req) ? aiRateLimiter(req, res, next) : next()));
router.use((req: Request, res: Response, next: NextFunction) => {
  const isPublicDemoRoute = req.path === '/public-demo' || req.path.startsWith('/public-demo/');
  if (req.user?.isDemo === true && !isPublicDemoRoute) {
    return res.status(403).json({
      success: false,
      error: 'Demo accounts can use stateless demo chat only',
    });
  }
  next();
});
router.use(messagesRouter);
router.use(completionsRouter);
router.use(publicDemoRouter);
router.use(turnTakingRouter);

router.use(conversationsRouter);
router.use(importSessionRouter);

export default router;
