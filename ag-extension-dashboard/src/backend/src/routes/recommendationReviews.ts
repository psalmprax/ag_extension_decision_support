import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { query } from '@/services/databaseService';
import { getFarmerForPrincipal, getPrincipalTenantId } from '@/services/dataGovernanceService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

function principal(req: Request) {
  return req.user?.userId && req.user.role ? { userId: req.user.userId, role: req.user.role } : null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const tenantId = user.role === 'admin' ? (typeof req.query.tenantId === 'string' ? req.query.tenantId : null) : await getPrincipalTenantId(user.userId);
    if (!tenantId) return res.status(403).json({ success: false, error: 'Tenant membership required' });
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (!['pending', 'approved', 'dismissed', 'escalated'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid review status' });

    const result = await query(
      `SELECT id, farmer_id, report_id, recommendation, confidence, evidence_status, status,
              disposition, created_by, reviewed_by, created_at, reviewed_at
       FROM recommendation_reviews WHERE tenant_id = $1 AND status = $2 ORDER BY created_at ASC`,
      [tenantId, status]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('List recommendation reviews error:', error);
    return safeError(res, 500, 'Failed to load recommendation reviews');
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const { farmerId, reportId, recommendation, confidence, evidenceStatus = 'no_verified_source' } = req.body as Record<string, unknown>;
    if (typeof farmerId !== 'string' || typeof recommendation !== 'string' || recommendation.trim().length < 3 || recommendation.length > 10000) {
      return res.status(400).json({ success: false, error: 'farmerId and recommendation are required' });
    }
    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 100)) {
      return res.status(400).json({ success: false, error: 'confidence must be between 0 and 100' });
    }
    if (!['verified_source', 'no_verified_source'].includes(String(evidenceStatus))) {
      return res.status(400).json({ success: false, error: 'Invalid evidence status' });
    }
    const farmer = await getFarmerForPrincipal(farmerId, user);
    if (!farmer) return res.status(403).json({ success: false, error: 'Access denied to farmer' });

    const result = await query(
      `INSERT INTO recommendation_reviews
        (tenant_id, farmer_id, report_id, created_by, recommendation, confidence, evidence_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, farmer_id, report_id, recommendation, confidence, evidence_status, status, created_at`,
      [farmer.tenant_id, farmerId, typeof reportId === 'string' ? reportId : null, user.userId, recommendation.trim(), confidence ?? null, evidenceStatus]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Create recommendation review error:', error);
    return safeError(res, 500, 'Failed to create recommendation review');
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const { status, disposition } = req.body as Record<string, unknown>;
    if (!['approved', 'dismissed', 'escalated'].includes(String(status)) || typeof disposition !== 'string' || disposition.trim().length < 3 || disposition.length > 5000) {
      return res.status(400).json({ success: false, error: 'A valid status and disposition are required' });
    }

    const reviewTarget = await query<{ farmer_id: string | null }>(
      'SELECT farmer_id FROM recommendation_reviews WHERE id = $1 AND status = \'pending\'',
      [req.params.id]
    );
    const farmerId = reviewTarget.rows[0]?.farmer_id;
    if (!farmerId || !(await getFarmerForPrincipal(farmerId, user))) {
      return res.status(404).json({ success: false, error: 'Pending review not found' });
    }

    const result = await query(
      `UPDATE recommendation_reviews
       SET status = $1, disposition = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING id, status, disposition, reviewed_by, reviewed_at`,
      [status, disposition.trim(), user.userId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Pending review not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Update recommendation review error:', error);
    return safeError(res, 500, 'Failed to update recommendation review');
  }
});

export default router;
