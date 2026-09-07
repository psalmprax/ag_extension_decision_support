import { Router } from 'express';
import { authorize } from '@/middleware/authorize';

import synthesisRouter from './synthesis';
import speechRouter from './speech';
import visionRouter from './vision';
import agentsRouter from './agents';

const router = Router();

// Apply authentication to all AI routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

router.use(synthesisRouter);
router.use(speechRouter);
router.use(visionRouter);
router.use(agentsRouter);

export default router;
