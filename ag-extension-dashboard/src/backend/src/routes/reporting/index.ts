import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import crudRouter from './crud';
import generateRouter from './generate';
import downloadsRouter from './downloads';
import { createShareRoute } from '../shareRouteFactory';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';

const router = Router();

// Apply authentication to all reporting routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));
router.use(requirePaidPlan('reports'));

router.use(crudRouter);
router.use(generateRouter);
router.use(downloadsRouter);
router.use(createShareRoute('report'));

export default router;
