import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import {
    getTenantBySlug,
    listTenants,
    validateTenantAdvisoryCompliance,
    assertTenantAccess,
} from '@/services/multiTenantFederationService';

const router = Router();

router.get('/tenant/:slug', async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const tenant = await getTenantBySlug(req.params.slug);
        if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

        // A caller may only read a tenant they belong to (admins excepted).
        const access = await assertTenantAccess(user.userId, user.role, tenant.id);
        if (!access.allowed) {
            return res.status(403).json({ success: false, error: access.reason || 'Forbidden' });
        }

        const registry = await listTenants();
        return res.json({
            success: true,
            data: tenant,
            provenance: { source: registry.source, demoData: registry.demoData },
        });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/tenant/advisory-compliance', checkUsageLimit('ai_chat'), validate({ body: z.object({ tenantId: z.string().min(1), crop: z.string().min(1), proposedChemicals: z.array(z.string()) }) }), async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        // The client-supplied tenantId is a request, not an authority: it is checked
        // against the caller's own membership before any compliance decision is made.
        const access = await assertTenantAccess(user.userId, user.role, req.body.tenantId);
        if (!access.allowed || !access.tenantId) {
            return res.status(403).json({ success: false, error: access.reason || 'Forbidden' });
        }

        const result = await validateTenantAdvisoryCompliance(
            access.tenantId,
            req.body.crop,
            req.body.proposedChemicals
        );

        // Unknown tenant means the banned-chemical check could not run: reject rather
        // than returning a pass the caller could act on.
        if (!result.tenantKnown) {
            return res.status(400).json({
                success: false,
                errorCode: 'UNKNOWN_TENANT',
                error: result.reason,
            });
        }

        return res.json({ success: true, data: result });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
