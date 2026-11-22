import { Router } from 'express';
import { authorize } from '@/middleware/authorize';

import hazardRouter from './hazard';
import voiceRouter from './voice';

/**
 * The capabilities that grew out of the architecture pillars and are in real use:
 * weather hazard evaluation and speech (transcribe, local transcribe, synthesize).
 * The prototype routes that only ever answered 501 in a deployment were removed; see
 * docs/PILLAR_SERVICES_DECISION.md.
 */
const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));
router.use(hazardRouter);
router.use(voiceRouter);

export default router;
