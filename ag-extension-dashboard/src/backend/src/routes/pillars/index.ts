import { Router, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';

import traceabilityRouter from './traceability';
import creditRouter from './credit';
import pestRouter from './pest';
import tradeRouter from './trade';
import mechanizationRouter from './mechanization';
import telemetryRouter from './telemetry';
import voiceRouter from './voice';
import tenantRouter from './tenant';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

/**
 * Specification-phase gate.
 *
 * Most services behind this router are @deprecated prototypes (see
 * docs/PILLAR_SERVICES_DECISION.md): they compute from hardcoded registries and
 * illustrative constants. Only the endpoints the product actually uses are always
 * on; everything else returns 501 unless PILLARS_SPEC_ROUTES_ENABLED=true is set
 * for a sandbox/demo deployment. Responses from gated routes are stamped
 * `dataStatus: 'specification_prototype'` so nothing downstream mistakes them for
 * verified data.
 */
const PRODUCTION_PILLAR_ROUTES = new Set<string>([
    'POST /hazard/evaluate',
    'POST /voice/transcribe',
    'POST /voice/transcribe-local',
]);

router.use((req: AuthRequest, res: Response, next) => {
    const key = `${req.method} ${req.path}`;
    if (PRODUCTION_PILLAR_ROUTES.has(key)) return next();
    if (process.env.PILLARS_SPEC_ROUTES_ENABLED === 'true') {
        // Stamp prototype provenance onto every JSON body from a gated route.
        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            if (body && typeof body === 'object' && !Array.isArray(body)) {
                return originalJson({ ...(body as Record<string, unknown>), dataStatus: 'specification_prototype' });
            }
            return originalJson(body);
        };
        return next();
    }
    return res.status(501).json({
        success: false,
        errorCode: 'PILLAR_NOT_IMPLEMENTED',
        error: 'This capability is a specification-phase prototype and is not enabled in this deployment.',
        route: key,
    });
});

router.use(traceabilityRouter);
router.use(creditRouter);
router.use(pestRouter);
router.use(tradeRouter);
router.use(mechanizationRouter);
router.use(telemetryRouter);
router.use(voiceRouter);
router.use(tenantRouter);

export default router;
