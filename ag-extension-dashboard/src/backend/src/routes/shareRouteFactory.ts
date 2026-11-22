import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { shareService, ShareNotFoundError } from '@/services/shareService';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

export const SHARE_ENTITY_TYPES = ['farmer', 'visit', 'report', 'knowledge'] as const;
export type ShareEntityType = (typeof SHARE_ENTITY_TYPES)[number];

const isEntityType = (value: unknown): value is ShareEntityType =>
    typeof value === 'string' && (SHARE_ENTITY_TYPES as readonly string[]).includes(value);

/**
 * Creates a share link for one entity, answering 400 for a malformed request, 403
 * without an organisation, 404 when the entity is missing or not the person's to share,
 * and 201 with the link otherwise. Both share routes use it.
 */
export async function respondWithShare(req: Request, res: Response, entityType: unknown, entityId: unknown): Promise<void> {
    const user = req.user;
    if (!user?.userId || !user.role) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
    }
    if (!isEntityType(entityType) || typeof entityId !== 'string' || entityId.length === 0) {
        res.status(400).json({ success: false, error: `entityType must be one of ${SHARE_ENTITY_TYPES.join(', ')}, with an entityId` });
        return;
    }
    const { isPublic, expiresAt, permissions } = (req.body ?? {}) as { isPublic?: unknown; expiresAt?: unknown; permissions?: unknown };
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : undefined;
    if (expiry && Number.isNaN(expiry.getTime())) {
        res.status(400).json({ success: false, error: 'expiresAt must be a date' });
        return;
    }
    if (permissions !== undefined && !(Array.isArray(permissions) && permissions.every(p => typeof p === 'string'))) {
        res.status(400).json({ success: false, error: 'permissions must be a list of strings' });
        return;
    }
    try {
        const tenantId = await getPrincipalTenantId(user.userId);
        if (!tenantId && user.role !== 'admin') {
            res.status(403).json({ success: false, error: 'Tenant membership required' });
            return;
        }
        const shareLink = await shareService.createShare({
            entityType,
            entityId,
            createdBy: user.userId,
            principal: { userId: user.userId, role: user.role, isDemo: user.isDemo },
            tenantId: tenantId ?? undefined,
            isPublic: isPublic === true,
            expiresAt: expiry,
            permissions: permissions as string[] | undefined,
        });
        res.status(201).json({ success: true, data: shareLink });
    } catch (error) {
        if (error instanceof ShareNotFoundError) {
            res.status(404).json({ success: false, error: error.message });
            return;
        }
        logger.error(`Error creating ${entityType} share:`, error);
        safeError(res, 500, 'Failed to create share link');
    }
}

/** POST /:id/share for one entity type, mounted under the farmers, visits, reports and knowledge routers. */
export function createShareRoute(entityType: ShareEntityType): Router {
    const router = Router();
    // Mounted under authed parents today; required here too so a standalone mount can never create orphan shares.
    router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));
    router.post('/:id/share', (req: Request, res: Response) => respondWithShare(req, res, entityType, req.params.id));
    return router;
}
