/**
 * Service access: the system administrator lets one account use a paid service
 * (for example a Free farmer messaging their officer) without changing its plan.
 *
 *   GET    /api/v1/users/:id/service-access            services this account may be given, and its active grants
 *   PUT    /api/v1/users/:id/service-access/:service   grant (or change the end date / note)
 *   DELETE /api/v1/users/:id/service-access/:service   revoke
 *
 * Mounted on /users ahead of the users router, so every route carries its own guards.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authorize, type AuthRequest } from '@/middleware/authorize';
import { requireSystemAdmin } from '@/middleware/requireSystemAdmin';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { validate } from '@/middleware/validationMiddleware';
import { query } from '@/services/databaseService';
import { PAID_SERVICES, isGrantableTo, isPaidService, type PaidService } from '@/services/paidServices';
import { grantServiceAccess, listServiceAccess, revokeServiceAccess } from '@/services/serviceAccessService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();
const systemAdmin = [authorize(['admin']), requireSystemAdmin];

const idParams = z.object({ id: z.string().uuid() });
const serviceParams = idParams.extend({ service: z.string().refine(isPaidService, 'Unknown service') });
const grantSchema = z.object({
  params: serviceParams,
  body: z.object({
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
});

async function targetRole(userId: string): Promise<string | null> {
  const res = await query<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
  return res.rows[0]?.role ?? null;
}

const grantableFor = (role: string) =>
  (Object.keys(PAID_SERVICES) as PaidService[])
    .filter(service => isGrantableTo(service, role))
    .map(service => ({ service, label: PAID_SERVICES[service].label }));

router.get('/:id/service-access', ...systemAdmin, validate(z.object({ params: idParams })), async (req: AuthRequest, res: Response) => {
  try {
    const role = await targetRole(req.params.id);
    if (!role) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { grantable: grantableFor(role), active: await listServiceAccess(req.params.id) } });
  } catch (error) {
    logger.error('Failed to list service access:', error);
    safeError(res, 500, 'Failed to load service access');
  }
});

router.put('/:id/service-access/:service', ...systemAdmin, validate(grantSchema), auditMiddleware('service_access.grant'), async (req: AuthRequest, res: Response) => {
  try {
    const service = req.params.service as PaidService;
    const role = await targetRole(req.params.id);
    if (!role) return res.status(404).json({ success: false, error: 'User not found' });
    if (!isGrantableTo(service, role)) {
      return res.status(400).json({ success: false, error: `${PAID_SERVICES[service].label} cannot be granted to a ${role.replace(/_/g, ' ')} account` });
    }
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'The end date must be in the future' });
    }
    await grantServiceAccess({ userId: req.params.id, service, grantedBy: req.user!.userId, expiresAt, note: req.body.note || null });
    logger.info(`System administrator ${req.user!.userId} granted ${service} to user ${req.params.id}`);
    res.json({ success: true, data: { active: await listServiceAccess(req.params.id) } });
  } catch (error) {
    logger.error('Failed to grant service access:', error);
    safeError(res, 500, 'Failed to grant service access');
  }
});

router.delete('/:id/service-access/:service', ...systemAdmin, validate(z.object({ params: serviceParams })), auditMiddleware('service_access.revoke'), async (req: AuthRequest, res: Response) => {
  try {
    const service = req.params.service as PaidService;
    if (!(await revokeServiceAccess(req.params.id, service, req.user!.userId))) {
      return res.status(404).json({ success: false, error: 'No active access to revoke' });
    }
    logger.info(`System administrator ${req.user!.userId} revoked ${service} from user ${req.params.id}`);
    res.json({ success: true, data: { active: await listServiceAccess(req.params.id) } });
  } catch (error) {
    logger.error('Failed to revoke service access:', error);
    safeError(res, 500, 'Failed to revoke service access');
  }
});

export default router;
