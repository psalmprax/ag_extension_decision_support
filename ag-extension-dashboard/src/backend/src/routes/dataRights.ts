import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { auditDataAction, getFarmerForPrincipal, principalFromRequest } from '@/services/dataGovernanceService';
import { purgeStoredUpload } from '@/services/uploadService';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

function getPrincipal(req: Request) {
  return principalFromRequest(req.user ? { userId: req.user.userId, role: req.user.role } : undefined);
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

router.get('/farmers/:farmerId/consents', async (req: Request, res: Response) => {
  try {
    const user = getPrincipal(req);
    const farmerId = req.params.farmerId;
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!(await getFarmerForPrincipal(farmerId, user))) return res.status(403).json({ success: false, error: 'Access denied' });

    const result = await query(
      `SELECT id, purpose, version, status, metadata, consented_at, withdrawn_at
       FROM data_consents WHERE farmer_id = $1 ORDER BY consented_at DESC`,
      [farmerId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('List consent records error:', error);
    return safeError(res, 500, 'Failed to list consent records');
  }
});

router.post('/farmers/:farmerId/consents', async (req: Request, res: Response) => {
  try {
    const user = getPrincipal(req);
    const farmerId = req.params.farmerId;
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const farmer = await getFarmerForPrincipal(farmerId, user);
    if (!farmer) return res.status(403).json({ success: false, error: 'Access denied' });

    const { purpose, version, metadata = {} } = req.body as Record<string, unknown>;
    if (!validText(purpose, 120) || !validText(version, 40) || typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      return res.status(400).json({ success: false, error: 'purpose, version, and object metadata are required' });
    }

    const result = await query(
      `WITH withdrawn AS (
         UPDATE data_consents SET status = 'superseded', withdrawn_at = NOW()
         WHERE farmer_id = $1 AND purpose = $2 AND status = 'granted'
       )
       INSERT INTO data_consents (tenant_id, farmer_id, recorded_by, purpose, version, status, metadata)
       VALUES ($3, $1, $4, $2, $5, 'granted', $6)
       RETURNING id, purpose, version, status, metadata, consented_at`,
      [farmerId, purpose.trim(), farmer.tenant_id, user.userId, version.trim(), JSON.stringify(metadata)]
    );
    const consent = result.rows[0];
    await auditDataAction(user, 'data_consent_granted', { farmerId, purpose: purpose.trim(), version: version.trim() });
    return res.status(201).json({ success: true, data: consent });
  } catch (error) {
    logger.error('Create consent record error:', error);
    return safeError(res, 500, 'Failed to record consent');
  }
});

router.delete('/farmers/:farmerId/consents/:consentId', async (req: Request, res: Response) => {
  try {
    const user = getPrincipal(req);
    const { farmerId, consentId } = req.params;
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!(await getFarmerForPrincipal(farmerId, user))) return res.status(403).json({ success: false, error: 'Access denied' });

    const result = await query(
      `UPDATE data_consents SET status = 'withdrawn', withdrawn_at = COALESCE(withdrawn_at, NOW())
       WHERE id = $1 AND farmer_id = $2 AND status = 'granted'
       RETURNING id, purpose, status, withdrawn_at`,
      [consentId, farmerId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Active consent not found' });
    await auditDataAction(user, 'data_consent_withdrawn', { farmerId, consentId });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Withdraw consent error:', error);
    return safeError(res, 500, 'Failed to withdraw consent');
  }
});

router.get('/farmers/:farmerId/export', async (req: Request, res: Response) => {
  try {
    const user = getPrincipal(req);
    const farmerId = req.params.farmerId;
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const farmer = await getFarmerForPrincipal(farmerId, user);
    if (!farmer) return res.status(403).json({ success: false, error: 'Access denied' });

    const [farmerResult, visits, consents, uploads] = await Promise.all([
      query(`SELECT id, first_name, last_name, phone, location, village, district, region,
                    country, farm_size_hectares, crops, language_preference, is_active,
                    created_at, updated_at
             FROM farmers WHERE id = $1`, [farmerId]),
      query(`SELECT id, visit_type, status, scheduled_at, started_at, completed_at,
                    duration_minutes, notes, outcomes, follow_up_required, created_at, updated_at
             FROM visits WHERE farmer_id = $1 ORDER BY created_at ASC`, [farmerId]),
      query(`SELECT id, purpose, version, status, metadata, consented_at, withdrawn_at
             FROM data_consents WHERE farmer_id = $1 ORDER BY consented_at ASC`, [farmerId]),
      query(`SELECT id, original_name, mime_type, size_bytes, sha256, status, created_at, deleted_at
             FROM upload_records WHERE farmer_id = $1 ORDER BY created_at ASC`, [farmerId]),
    ]);

    const exportResult = await query<{ id: string }>(
      `INSERT INTO data_export_requests (tenant_id, farmer_id, requested_by, status, completed_at)
       VALUES ($1, $2, $3, 'completed', NOW()) RETURNING id`,
      [farmer.tenant_id, farmerId, user.userId]
    );
    await auditDataAction(user, 'farmer_data_exported', { farmerId, exportId: exportResult.rows[0]?.id });

    return res.json({
      success: true,
      data: {
        exportId: exportResult.rows[0]?.id,
        generatedAt: new Date().toISOString(),
        farmer: farmerResult.rows[0] ?? null,
        visits: visits.rows,
        consents: consents.rows,
        uploads: uploads.rows,
      },
    });
  } catch (error) {
    logger.error('Farmer data export error:', error);
    return safeError(res, 500, 'Failed to export farmer data');
  }
});

router.delete('/farmers/:farmerId', async (req: Request, res: Response) => {
  try {
    const user = getPrincipal(req);
    const farmerId = req.params.farmerId;
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const farmer = await getFarmerForPrincipal(farmerId, user);
    if (!farmer) return res.status(403).json({ success: false, error: 'Access denied' });
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, error: 'Deletion requires confirm: true' });
    }

    const result = await query<{ id: string; is_active: boolean | null }>(
      `UPDATE farmers
       SET is_active = false, first_name = 'Deleted', last_name = 'Farmer', phone = NULL,
           location = NULL, village = NULL, district = NULL, yield_history = NULL,
           location_lat = NULL, location_lng = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_active`,
      [farmerId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Farmer not found' });

    await query(`UPDATE visits SET notes = NULL, outcomes = NULL, updated_at = NOW() WHERE farmer_id = $1`, [farmerId]);
    const uploads = await query<{ storage_key: string }>(
      `UPDATE upload_records SET status = 'deleted', deleted_at = COALESCE(deleted_at, NOW())
       WHERE farmer_id = $1 AND status = 'active' RETURNING storage_key`,
      [farmerId]
    );
    await Promise.all(uploads.rows.map(upload => purgeStoredUpload(upload.storage_key)));
    await auditDataAction(user, 'farmer_data_deleted', { farmerId, idempotent: farmer.is_active === false, purgedUploads: uploads.rows.length });

    return res.json({ success: true, data: { farmerId, status: 'deleted' } });
  } catch (error) {
    logger.error('Farmer data deletion error:', error);
    return safeError(res, 500, 'Failed to delete farmer data');
  }
});

export default router;
