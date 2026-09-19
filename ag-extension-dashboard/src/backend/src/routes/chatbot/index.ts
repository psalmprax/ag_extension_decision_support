import { Router } from 'express';
import conversationsRouter from './conversations';
import messagesRouter from './messages';
import completionsRouter from './completions';
import publicDemoRouter from './publicDemo';
import importSessionRouter from './importSession';
import { aiRateLimiter } from '@/middleware/rateLimitMiddleware';

const router = Router();

// Generation routes only: messages/completions/publicDemo hit AI providers on
// every call, so they pass through the dedicated (smaller) AI bucket before
// their own auth/usage middleware. Read-side sub-routers (conversations,
// importSession) stay on the general per-user limiter only.
router.use(aiRateLimiter);
router.use(messagesRouter);
router.use(completionsRouter);
router.use(publicDemoRouter);

router.use(conversationsRouter);
router.use(importSessionRouter);

export default router;
