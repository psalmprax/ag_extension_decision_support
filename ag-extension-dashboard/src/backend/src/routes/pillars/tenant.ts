import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { getTenantBySlug, validateTenantAdvisoryCompliance } from '@/services/multiTenantFederationService';

const router = Router();

router.get('/tenant/:slug', async (req: AuthRequest, res: Response) => {
    try {
        const tenant = getTenantBySlug(req.params.slug);
        if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
        return res.json({ success: true, data: tenant });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/tenant/advisory-compliance', checkUsageLimit('ai_chat'), validate({ body: z.object({ tenantId: z.string().min(1), crop: z.string().min(1), proposedChemicals: z.array(z.string()) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: validateTenantAdvisoryCompliance(req.body.tenantId, req.body.crop, req.body.proposedChemicals) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
