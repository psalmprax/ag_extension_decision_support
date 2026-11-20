import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import type {
  CountRow,
  SatisfactionAvgRow,
  AuthenticatedRequestUser,
} from '@/types/rowTypes';
import {
  mapCountRow,
  mapSatisfactionAvgRow,
} from '@/types/dtos';
import { AIUnavailableError } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { chatCompletionSchema } from '@/shared-api/chatbot';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { AdvisoryTimeoutError } from '@/services/knowledge/advisoryRuntime';
import { generateAdvisoryAnswer } from '@/services/chat/advisoryAnswer';
import { assertConversationAccess, MessageAccessError, resolvePrincipalRegion, type ConversationAccess } from '@/services/messageAccessService';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

async function conversationAccess(conversationId: string, user: AuthenticatedRequestUser): Promise<ConversationAccess | null> {
  try {
    return await assertConversationAccess(user, conversationId);
  } catch (error) {
    if (error instanceof MessageAccessError) return null;
    throw error;
  }
}

type TurnPlan = { storeIn: string | undefined } | { status: number; error: string };

/**
 * Where a turn is stored. Officers never trigger an automatic AI reply in a
 * farmer's thread: they send plain messages (POST /chatbot/messages) and ask
 * the copilot for a draft, which uses the thread as context, is shown only to
 * them and is stored nowhere.
 */
async function planTurn(user: AuthenticatedRequestUser, conversationId: string | undefined, mode: 'send' | 'draft'): Promise<TurnPlan> {
  if (!conversationId) return { storeIn: undefined };
  const access = await conversationAccess(conversationId, user);
  if (!access) return { status: 404, error: 'Conversation not found' };
  if (mode === 'draft') {
    return user.role === 'farmer'
      ? { status: 400, error: 'Drafts are for officers.' }
      : { storeIn: undefined };
  }
  if (access.kind === 'farmer_thread' && user.role !== 'farmer') {
    return {
      status: 409,
      error: 'Officer messages in a farmer thread are sent as plain messages. Ask the copilot for a private draft instead.',
    };
  }
  return { storeIn: conversationId };
}

// Request contract = shared `chatCompletionSchema` (camelCase) + legacy `conversation_id`.
const completionsBodySchema = chatCompletionSchema
  .extend({
    conversation_id: z.string().uuid().optional(),
    country: z.string().trim().min(2).max(100).optional(),
    /** draft: an officer's private copilot draft for a thread; nothing is stored. */
    mode: z.enum(['send', 'draft']).optional(),
  })
  .transform(b => ({ ...b, conversationId: b.conversationId ?? b.conversation_id }));

router.post('/completions', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), validate({ body: completionsBodySchema }), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const parsed = req.body as z.infer<typeof completionsBodySchema>;
    const body = { message: parsed.message, conversation_id: parsed.conversationId, language: parsed.language };
    const rawMessage = body.message?.trim();
    if (!rawMessage) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    // eslint-disable-next-line no-control-regex
    const sanitizedMessage = rawMessage.slice(0, 2000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    if (user.isDemo && body.conversation_id) {
      return res.status(403).json({ success: false, error: 'Demo chat is stateless; persistent conversations are unavailable' });
    }

    const turn = await planTurn(user, body.conversation_id, parsed.mode ?? 'send');
    if ('error' in turn) {
      return res.status(turn.status).json({ success: false, error: turn.error });
    }

    const answer = await generateAdvisoryAnswer({
      message: sanitizedMessage,
      language: body.language,
      country: parsed.country,
      contextConversationId: body.conversation_id,
      storeIn: turn.storeIn,
      // Standalone assistant requests (without a conversation) are not chat history.
      storeQuestionAs: user.role === 'farmer' ? 'user' : 'officer',
      requester: { userId: user.userId, role: user.role, isDemo: user.isDemo },
    });

    return res.json({
      success: true,
      data: {
        messages: [
          { role: 'user', content: sanitizedMessage },
          { role: 'assistant', content: answer.text },
        ],
        citations: answer.citations,
        advisoryQuality: answer.evidence,
        usedTools: answer.usedTools,
        safety: answer.safety,
        draft: parsed.mode === 'draft',
        review: answer.reviewTrigger
          ? { queued: false, scheduled: true, trigger: answer.reviewTrigger }
          : { queued: false },
      },
    });
  } catch (error) {
    logger.error('Chat completion failed:', error);
    if (error instanceof AdvisoryTimeoutError || error instanceof AIUnavailableError) {
      return safeError(res, 503, 'The AI assistant is not available right now');
    }
    return safeError(res, 500, 'Chat completion failed');
  }
});

/**
 * GET /api/chatbot/stats/overview — 7-day conversation volume + average satisfaction.
 */
router.get('/stats/overview', authorize(['admin', 'regional_manager', 'extension_officer']), async (req: AuthedRequest, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    const user = req.user!;
    let scopeClause = '';
    const scopeParams: string[] = [];
    if (user.role === 'regional_manager') {
      scopeParams.push((await resolvePrincipalRegion(user.userId)) ?? '');
    } else if (user.role === 'extension_officer') {
      scopeParams.push(user.userId);
    }
    if (user.role === 'regional_manager') {
      scopeClause = ' AND f.region = $1';
    } else if (user.role === 'extension_officer') {
      scopeClause = ' AND cv.officer_id = $1';
    }
    const joinFarmers = user.role === 'regional_manager'
      ? ' LEFT JOIN farmers f ON f.id = cv.farmer_id'
      : '';
    const { rows: countRows } = await query<CountRow>(
      `SELECT COUNT(*) AS count FROM chat_conversations cv${joinFarmers}
        WHERE cv.started_at > NOW() - INTERVAL '7 days'${scopeClause}`,
      scopeParams
    );
    const { rows: satRows } = await query<SatisfactionAvgRow>(
      `SELECT AVG(satisfaction_score)::numeric(10,4) AS avg_satisfaction,
              COUNT(satisfaction_score)            AS total_ratings
         FROM chat_conversations cv${joinFarmers}
        WHERE cv.satisfaction_score IS NOT NULL${scopeClause}`,
      scopeParams
    );

    const [conversations7d] = countRows.map(mapCountRow);
    const satisfaction = satRows[0] ? mapSatisfactionAvgRow(satRows[0]) : null;

    return res.json({
      success: true,
      data: {
        conversations7d: conversations7d?.count ?? 0,
        avgSatisfaction: satisfaction?.avgSatisfaction ?? null,
        totalRatings: satisfaction?.totalRatings ?? 0,
      },
    });
  } catch (error) {
    logger.error('Failed to compute chat stats:', error);
    return safeError(res, 500, 'Failed to compute chat stats');
  }
});

export default router;
