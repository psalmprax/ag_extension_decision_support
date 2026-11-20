import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { authorize } from '@/middleware/authorize';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import type { AuthenticatedRequestUser } from '@/types/rowTypes';

const router = Router();

// Protocols belong to an organisation: staff only, and only their own organisation's
// (administrators see every organisation). Reads were open to anyone before.
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/** SQL condition limiting rows to the caller's organisation (none for administrators). */
async function tenantCondition(req: Request, nextIndex: number): Promise<{ sql: string; params: unknown[] }> {
  const user = (req as AuthedRequest).user;
  if (!user || user.role === 'admin') return { sql: 'TRUE', params: [] };
  const { rows } = await query<{ tenant_id: string | null }>('SELECT tenant_id FROM users WHERE id = $1', [user.userId]);
  return { sql: `tenant_id IS NOT DISTINCT FROM $${nextIndex}`, params: [rows[0]?.tenant_id ?? null] };
}

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

interface AdvisoryWorkflowRow {
  id: string;
  tenant_id: string | null;
  title: string;
  description: string | null;
  category: string;
  status: string;
  version: number;
  steps_json: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapAdvisoryWorkflow(row: AdvisoryWorkflowRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    version: row.version,
    stepsJson: typeof row.steps_json === 'string' ? JSON.parse(row.steps_json) : (row.steps_json ?? []),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const createWorkflowSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().optional().default(''),
  category: z.string().optional().default('general'),
  status: z.enum(['draft', 'published']).optional().default('draft'),
  stepsJson: z.union([z.array(z.record(z.string(), z.any())), z.record(z.string(), z.any())]).default([]),
});

const updateWorkflowSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  stepsJson: z.union([z.array(z.record(z.string(), z.any())), z.record(z.string(), z.any())]).optional(),
});

/**
 * GET /api/v1/workflows — List all advisory workflows
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const tenant = await tenantCondition(req, params.length + 1);
    params.push(...tenant.params);
    conditions.push(tenant.sql);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT * FROM advisory_workflows
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const { rows } = await query<AdvisoryWorkflowRow>(sql, params);
    return res.json({
      success: true,
      data: rows.map(mapAdvisoryWorkflow),
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to list advisory workflows:', error);
    return safeError(res, 500, 'Failed to list advisory workflows');
  }
});

/**
 * POST /api/v1/workflows — Create a new advisory workflow
 */
router.post(
  '/',
  authorize(['admin', 'regional_manager', 'extension_officer']),
  validate({ body: createWorkflowSchema }),
  async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.user;
      const { title, description, category, status, stepsJson } = req.body;

      const { rows } = await query<AdvisoryWorkflowRow>(
        `INSERT INTO advisory_workflows (title, description, category, status, version, steps_json, created_by, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $6, (SELECT tenant_id FROM users WHERE id = $6), NOW(), NOW())
         RETURNING *`,
        [title, description || null, category || 'general', status || 'draft', JSON.stringify(stepsJson), user?.userId || null]
      );

      const created = rows[0];
      if (!created) {
        return safeError(res, 500, 'Failed to create advisory workflow');
      }

      logger.info('Created advisory workflow', { id: created.id, title: created.title, user: user?.userId });
      return res.status(201).json({
        success: true,
        data: mapAdvisoryWorkflow(created),
      });
    } catch (error) {
      logger.error('Failed to create advisory workflow:', error);
      return safeError(res, 500, 'Failed to create advisory workflow');
    }
  }
);

/**
 * GET /api/v1/workflows/:id — Get a single advisory workflow by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await tenantCondition(req, 2);
    const { rows } = await query<AdvisoryWorkflowRow>(
      `SELECT * FROM advisory_workflows WHERE id = $1 AND ${tenant.sql} LIMIT 1`,
      [id, ...tenant.params]
    );

    const workflow = rows[0];
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Advisory workflow not found' });
    }

    return res.json({
      success: true,
      data: mapAdvisoryWorkflow(workflow),
    });
  } catch (error) {
    logger.error('Failed to get advisory workflow:', error);
    return safeError(res, 500, 'Failed to get advisory workflow');
  }
});

/**
 * PUT /api/v1/workflows/:id — Update an advisory workflow
 */
router.put(
  '/:id',
  authorize(['admin', 'regional_manager', 'extension_officer']),
  validate({ body: updateWorkflowSchema }),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, category, status, stepsJson } = req.body;

      const tenant = await tenantCondition(req, 2);
      const { rows: existingRows } = await query<AdvisoryWorkflowRow>(
        `SELECT * FROM advisory_workflows WHERE id = $1 AND ${tenant.sql} LIMIT 1`,
        [id, ...tenant.params]
      );

      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Advisory workflow not found' });
      }

      const updatedTitle = title ?? existing.title;
      const updatedDesc = description !== undefined ? description : existing.description;
      const updatedCategory = category ?? existing.category;
      const updatedStatus = status ?? existing.status;
      const updatedSteps = stepsJson !== undefined ? JSON.stringify(stepsJson) : JSON.stringify(existing.steps_json);

      const { rows } = await query<AdvisoryWorkflowRow>(
        `UPDATE advisory_workflows
         SET title = $1, description = $2, category = $3, status = $4, steps_json = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [updatedTitle, updatedDesc, updatedCategory, updatedStatus, updatedSteps, id]
      );

      const updated = rows[0];
      return res.json({
        success: true,
        data: updated ? mapAdvisoryWorkflow(updated) : null,
      });
    } catch (error) {
      logger.error('Failed to update advisory workflow:', error);
      return safeError(res, 500, 'Failed to update advisory workflow');
    }
  }
);

/**
 * POST /api/v1/workflows/:id/publish — Publish an advisory workflow and bump its version
 */
router.post(
  '/:id/publish',
  authorize(['admin', 'regional_manager', 'extension_officer']),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const tenant = await tenantCondition(req, 2);
      const { rows } = await query<AdvisoryWorkflowRow>(
        `UPDATE advisory_workflows
         SET status = 'published', version = version + 1, updated_at = NOW()
         WHERE id = $1 AND ${tenant.sql}
         RETURNING *`,
        [id, ...tenant.params]
      );

      const published = rows[0];
      if (!published) {
        return res.status(404).json({ success: false, error: 'Advisory workflow not found' });
      }

      logger.info('Published advisory workflow', { id: published.id, version: published.version });
      return res.json({
        success: true,
        data: mapAdvisoryWorkflow(published),
      });
    } catch (error) {
      logger.error('Failed to publish advisory workflow:', error);
      return safeError(res, 500, 'Failed to publish advisory workflow');
    }
  }
);

/**
 * DELETE /api/v1/workflows/:id — Delete or archive an advisory workflow
 */
router.delete(
  '/:id',
  authorize(['admin', 'regional_manager', 'extension_officer']),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const tenant = await tenantCondition(req, 2);
      const { rowCount } = await query(
        `DELETE FROM advisory_workflows WHERE id = $1 AND ${tenant.sql}`,
        [id, ...tenant.params]
      );

      if (rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Advisory workflow not found' });
      }

      return res.json({
        success: true,
        message: 'Advisory workflow deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete advisory workflow:', error);
      return safeError(res, 500, 'Failed to delete advisory workflow');
    }
  }
);

export default router;
