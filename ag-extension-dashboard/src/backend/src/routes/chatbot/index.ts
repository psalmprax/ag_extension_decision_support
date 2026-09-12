import { Router } from 'express';
import conversationsRouter from './conversations';
import messagesRouter from './messages';
import completionsRouter from './completions';
import publicDemoRouter from './publicDemo';

const router = Router();

router.use(conversationsRouter);
router.use(messagesRouter);
router.use(completionsRouter);
router.use(publicDemoRouter);

export default router;
