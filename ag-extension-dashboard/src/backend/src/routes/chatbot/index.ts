import { Router } from 'express';
import conversationsRouter from './conversations';
import messagesRouter from './messages';
import completionsRouter from './completions';

const router = Router();

router.use(conversationsRouter);
router.use(messagesRouter);
router.use(completionsRouter);

export default router;
