import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { query } from '@/services/databaseService';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

const supportedCurrencies = new Set(['USD', 'KES', 'MWK', 'ZMW', 'TZS', 'UGX', 'CAD', 'EUR', 'GBP']);
const supportedLanguages = new Set(['en', 'fr', 'sw', 'es', 'de', 'pt']);

function validateConfigUpdate(input: Record<string, unknown>): string | null {
  const { name, region, currency, language, capabilities } = input;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.length > 160)) return 'name must be between 2 and 160 characters';
  if (region !== undefined && (typeof region !== 'string' || region.length > 100)) return 'region is invalid';
  if (currency !== undefined && (typeof currency !== 'string' || !supportedCurrencies.has(currency))) return 'Unsupported currency';
  if (language !== undefined && (typeof language !== 'string' || !supportedLanguages.has(language))) return 'Unsupported release language';
  if (capabilities !== undefined && (typeof capabilities !== 'object' || capabilities === null || Array.isArray(capabilities))) return 'capabilities must be an object';
  return null;
}

async function resolveTenantId(req: Request): Promise<string | null> {
  if (!req.user?.userId) return null;
  const requestedTenant = typeof req.query.tenantId === 'string' ? req.query.tenantId : null;
  if (req.user.role === 'admin' && requestedTenant) return requestedTenant;
  return getPrincipalTenantId(req.user.userId);
}

router.get('/config', async (req: Request, res: Response) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ success: false, error: 'Tenant membership required' });

    const result = await query(
      `SELECT id, name, region, default_currency, default_language, capabilities, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Tenant not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Get organization config error:', error);
    return safeError(res, 500, 'Failed to load organization configuration');
  }
});

router.patch('/config', authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ success: false, error: 'Tenant membership required' });

    const input = req.body as Record<string, unknown>;
    const validationError = validateConfigUpdate(input);
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    const { name, region, currency, language, capabilities } = input;

    const result = await query(
      `UPDATE tenants
       SET name = COALESCE($2, name), region = COALESCE($3, region),
           default_currency = COALESCE($4, default_currency),
           default_language = COALESCE($5, default_language),
           capabilities = COALESCE($6::jsonb, capabilities), updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, region, default_currency, default_language, capabilities, updated_at`,
      [tenantId, name === undefined ? null : String(name).trim(), region ?? null, currency ?? null, language ?? null, capabilities === undefined ? null : JSON.stringify(capabilities)]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Tenant not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Update organization config error:', error);
    return safeError(res, 500, 'Failed to update organization configuration');
  }
});

export default router;
