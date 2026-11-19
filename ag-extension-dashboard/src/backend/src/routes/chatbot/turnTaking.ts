/**
 * Turn-taking between officers and the AI in farmer threads:
 * the organisation's rules, and the farmer's "Ask AI" button.
 */
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { query } from '@/services/databaseService';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import type { AuthenticatedRequestUser } from '@/types/rowTypes';
import { assertConversationAccess, MessageAccessError } from '@/services/messageAccessService';
import { resolveTurnTakingSettings, turnTakingSettingsSchema } from '@/services/chat/turnTaking';
import { answerFarmerInThread, loadThreadForReply } from '@/services/chat/threadAutoReply';

const router = Router();
type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/** The organisation a user belongs to (their own row, else their farmer record). */
async function tenantOf(userId: string): Promise<string | null> {
  const { rows } = await query<{ tenant_id: string | null }>(
    `SELECT COALESCE(u.tenant_id, f.tenant_id) AS tenant_id
       FROM users u LEFT JOIN farmers f ON f.user_id = u.id
      WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0]?.tenant_id ?? null;
}

async function settingsFor(tenantId: string | null) {
  if (!tenantId) return resolveTurnTakingSettings(null);
  const { rows } = await query<{ capabilities: unknown }>('SELECT capabilities FROM tenants WHERE id = $1', [tenantId]);
  return resolveTurnTakingSettings(rows[0]?.capabilities ?? null);
}

/** GET /chatbot/turn-taking — the rules that apply to the caller's organisation. */
router.get('/turn-taking', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const tenantId = await tenantOf(req.user!.userId);
    return res.json({ success: true, data: { tenantId, settings: await settingsFor(tenantId) } });
  } catch (error) {
    logger.error('Failed to load turn-taking settings:', error);
    return safeError(res, 500, 'Failed to load chat settings');
  }
});

const putSchema = z.object({
  /** Platform admins without an organisation name the one they are editing. */
  tenantId: z.string().uuid().optional(),
  settings: turnTakingSettingsSchema,
});

/** PUT /chatbot/turn-taking — an admin sets their organisation's rules. */
router.put('/turn-taking', authorize(['admin']), validate({ body: putSchema }), async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body as z.infer<typeof putSchema>;
    const tenantId = body.tenantId ?? (await tenantOf(req.user!.userId));
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Choose the organisation these settings are for.' });
    }
    const { rows } = await query<{ capabilities: unknown }>(
      `UPDATE tenants
          SET capabilities = jsonb_set(COALESCE(capabilities, '{}'::jsonb), '{chatTurnTaking}', $2::jsonb),
              updated_at = NOW()
        WHERE id = $1
        RETURNING capabilities`,
      [tenantId, JSON.stringify(body.settings)],
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Organisation not found' });
    return res.json({ success: true, data: { tenantId, settings: resolveTurnTakingSettings(rows[0].capabilities) } });
  } catch (error) {
    logger.error('Failed to save turn-taking settings:', error);
    return safeError(res, 500, 'Failed to save chat settings');
  }
});

/**
 * POST /chatbot/conversations/:id/ask-ai — the farmer asks the AI to answer
 * their latest message now, without waiting for their officer.
 */
router.post('/conversations/:id/ask-ai', authorize(['farmer']), checkUsageLimit('ai_chat'), async (req: AuthedRequest, res: Response) => {
  try {
    await assertConversationAccess(req.user!, req.params.id);
    const thread = await loadThreadForReply(req.params.id);
    if (!thread?.question) {
      return res.status(400).json({ success: false, error: 'Send your question first, then tap Ask AI.' });
    }
    if (thread.aiAnsweredSinceFarmer) {
      return res.status(409).json({ success: false, error: 'The AI has already answered your latest message.' });
    }
    // checkUsageLimit above charged the farmer's own plan.
    await answerFarmerInThread(thread, 'farmer_request', { planChecked: true });
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof MessageAccessError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    logger.error('Ask AI failed:', error);
    return safeError(res, 500, 'The AI could not answer just now');
  }
});

export default router;
