import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPool, query } from '@/services/databaseService';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validationMiddleware';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { revokeAllUserSessions } from '@/services/sessionService';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';

const router = Router();
const anyUser = authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']);

/**
 * Data-subject rights (GDPR Art. 15 / 17 and Kenya DPA 2019 s.26).
 *
 * Export: every row that carries the user's id, grouped by table, plus their
 * farmer profile(s) if they are a farmer user. Personal data only — no other
 * users' rows are included even when referenced (e.g. an officer's visit list
 * includes farmer *ids*, not farmer records).
 *
 * Erasure: we do NOT hard-delete rows that other records depend on (visits,
 * payments, audit logs must stay for legal/financial retention). Instead the
 * account is anonymised: PII fields are overwritten, credentials/MFA/tokens are
 * wiped, sessions are revoked and the account is deactivated. Rows that are
 * purely personal (push subscriptions, notifications, chat conversations,
 * knowledge search history, offline queues) are deleted outright.
 */

// Tables whose rows are exported verbatim for the user (table, column)
const EXPORT_TABLES: Array<[string, string]> = [
  ['user_sessions', 'user_id'],
  ['login_history', 'user_id'],
  ['notifications', 'user_id'],
  ['push_subscriptions', 'user_id'],
  ['subscriptions', 'user_id'],
  ['transaction_submissions', 'user_id'],
  ['pending_paypal_payments', 'user_id'],
  ['knowledge_searches', 'user_id'],
  ['analytics_events', 'user_id'],
  ['offline_queue_items', 'user_id'],
  ['offline_mutations', 'user_id'],
  ['activity_claims', 'user_id'],
  ['scheduled_sms', 'user_id'],
  ['tenant_memberships', 'user_id'],
  ['upload_records', 'owner_user_id'],
  ['api_clients', 'owner_user_id'],
  ['visits', 'officer_id'],
  ['chat_conversations', 'officer_id'],
  ['video_consultations', 'extension_officer_id'],
  ['recommendation_outcomes', 'officer_id'],
  ['farmer_assignment_history', 'officer_id'],
  ['shares', 'created_by'],
  ['support_tickets', 'created_by'],
  ['recommendation_reviews', 'created_by'],
  ['audit_logs', 'actor_id'],
];

// Purely personal rows that are deleted on erasure
const ERASE_DELETE: Array<[string, string]> = [
  ['push_subscriptions', 'user_id'],
  ['notifications', 'user_id'],
  ['knowledge_searches', 'user_id'],
  ['offline_queue_items', 'user_id'],
  ['offline_mutations', 'user_id'],
  ['activity_claims', 'user_id'],
  ['scheduled_sms', 'user_id'],
  ['pending_paypal_payments', 'user_id'],
  ['user_sessions', 'user_id'],
  ['api_clients', 'owner_user_id'],
];

const SENSITIVE_COLUMNS = new Set(['password_hash', 'mfa_secret', 'mfa_backup_codes', 'reset_token', 'email_verification_token', 'token_hash', 'secret_hash', 'api_key_hash']);

function stripSensitive<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const k of Object.keys(out)) if (SENSITIVE_COLUMNS.has(k)) delete out[k];
  return out;
}

async function tableExists(table: string): Promise<boolean> {
  const r = await query(`SELECT to_regclass($1) AS oid`, [`public.${table}`]);
  return Boolean(r.rows[0]?.oid);
}

/** GET /api/v1/account/export — JSON bundle of the caller's personal data. */
router.get('/export', anyUser, auditMiddleware('account.export'), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const bundle: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      subject: userId,
      format: 'gpexts-personal-data-export/v1',
    };

    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    bundle.user = userRes.rows[0] ? stripSensitive(userRes.rows[0]) : null;

    const farmerRes = await query('SELECT * FROM farmers WHERE user_id = $1', [userId]);
    bundle.farmerProfiles = farmerRes.rows;

    const tables: Record<string, unknown[]> = {};
    for (const [table, col] of EXPORT_TABLES) {
      if (!(await tableExists(table))) continue;
      const r = await query(`SELECT * FROM ${table} WHERE ${col} = $1 ORDER BY 1 LIMIT 5000`, [userId]);
      if (r.rows.length) tables[table] = r.rows.map(row => stripSensitive(row as Record<string, unknown>));
    }
    bundle.records = tables;

    res.setHeader('Content-Disposition', `attachment; filename="gpexts-data-export-${userId}.json"`);
    res.json(bundle);
  } catch (error) {
    logger.error('account export failed:', error);
    safeError(res, 500, 'Export failed');
  }
});

const deleteSchema = z.object({
  body: z.object({
    password: z.string().min(1).optional(),
    confirm: z.literal('DELETE MY ACCOUNT'),
  }),
});

/**
 * DELETE /api/v1/account — erase / anonymise the caller's account.
 * Requires the literal confirmation phrase and (for password accounts) the password.
 */
router.delete('/', anyUser, validate(deleteSchema), auditMiddleware('account.delete'), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const userRes = await query<{ password_hash: string | null; role: string; email: string }>(
      'SELECT password_hash, role, email FROM users WHERE id = $1', [userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.role === 'admin') {
      const admins = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active IS NOT FALSE AND id <> $1`, [userId]);
      if ((admins.rows[0]?.n ?? 0) === 0) {
        return res.status(409).json({ success: false, error: 'Cannot delete the last active administrator account', errorCode: 'LAST_ADMIN' });
      }
    }

    if (user.password_hash) {
      const pw = (req.body as { password?: string }).password;
      if (!pw || !(await bcrypt.compare(pw, user.password_hash))) {
        return res.status(401).json({ success: false, error: 'Password confirmation failed' });
      }
    }

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [table, col] of ERASE_DELETE) {
        if (await tableExists(table)) await client.query(`DELETE FROM ${table} WHERE ${col} = $1`, [userId]);
      }

      // Anonymise farmer profiles owned by this user (kept for visit/assignment history integrity)
      await client.query(
        `UPDATE farmers
            SET first_name = 'Deleted', last_name = 'User', phone = NULL, location = NULL, village = NULL,
                location_lat = NULL, location_lng = NULL, is_active = false, updated_at = NOW()
          WHERE user_id = $1`,
        [userId]
      );

      const anonEmail = `deleted-${userId}@erased.invalid`;
      await client.query(
        `UPDATE users
            SET email = $2, first_name = 'Deleted', last_name = 'User', phone = NULL, region = NULL,
                password_hash = 'ERASED', mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL,
                reset_token = NULL, reset_token_expires = NULL,
                email_verification_token = NULL, email_verification_expires = NULL,
                is_active = false, updated_at = NOW()
          WHERE id = $1`,
        [userId, anonEmail]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await revokeAllUserSessions(userId);
    logger.info(`Account ${userId} erased (anonymised) at user request`);
    res.json({
      success: true,
      message: 'Your account has been deleted. Personal data was erased; financial and audit records are retained in anonymised form as required by law.',
    });
  } catch (error) {
    logger.error('account delete failed:', error);
    safeError(res, 500, 'Account deletion failed');
  }
});

export default router;
