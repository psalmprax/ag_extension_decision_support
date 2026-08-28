import { Router, Request, Response } from 'express';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { query, getPool } from '@/services/databaseService';
import type {
  ChatConversationRow,
  ChatMessageRow,
  CountRow,
  SatisfactionAvgRow,
  AuthenticatedRequestUser,
} from '@/types/rowTypes';
import {
  mapChatMessageRows,
  mapChatMessageRow,
  mapChatConversationRows,
  mapChatConversationRow,
  mapSatisfactionAvgRow,
  mapCountRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/**
 * Helper to get farmer record id for a farmer user account.
 */
async function resolveFarmerId(userId: string): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM farmers WHERE user_id = $1 OR id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0]?.id || null;
}

/**
 * GET /api/chatbot/conversations — Role-based conversation listing.
 * - Admin: sees all conversations across all regional managers, extension officers, and farmers.
 * - Regional Manager: sees all conversations within their region.
 * - Extension Officer: sees all conversations with their assigned farmers (1-to-many).
 * - Farmer: sees their single conversation thread with their extension officer (1-to-1).
 */
router.get('/conversations', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 200);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

    let whereClause = '';
    const params: unknown[] = [];

    if (user.role === 'admin') {
      // Super admin / Admin sees all conversations
      whereClause = '1=1';
    } else if (user.role === 'regional_manager') {
      // Regional manager sees officers and farmers in their region
      params.push(user.region || '');
      whereClause = `(u.region = $1 OR f.region = $1 OR cv.officer_id = '${user.userId}')`;
    } else if (user.role === 'farmer') {
      // Farmer sees their conversation with their officer (1-to-1)
      const farmerId = await resolveFarmerId(user.userId);
      params.push(farmerId || user.userId);
      whereClause = `(cv.farmer_id = $1 OR cv.officer_id = $1)`;
    } else {
      // Extension Officer sees their assigned farmer chats (1-to-many)
      params.push(user.userId);
      whereClause = `cv.officer_id = $1`;
    }

    params.push(limit);
    params.push(offset);
    const limitParamIdx = params.length - 1;
    const offsetParamIdx = params.length;

    const sql = `
      SELECT 
        cv.id,
        cv.farmer_id,
        cv.officer_id,
        cv.language,
        cv.status,
        cv.started_at,
        cv.ended_at,
        cv.satisfaction_score,
        cv.created_at,
        TRIM(CONCAT(f.first_name, ' ', f.last_name)) AS farmer_name,
        f.region AS farmer_region,
        f.phone AS farmer_phone,
        u.name AS officer_name,
        u.email AS officer_email,
        u.region AS officer_region,
        COALESCE(
          (SELECT m.content FROM chat_messages m WHERE m.conversation_id = cv.id ORDER BY m.created_at DESC LIMIT 1),
          'Advisory session active'
        ) AS last_message,
        COALESCE(
          (SELECT m.created_at FROM chat_messages m WHERE m.conversation_id = cv.id ORDER BY m.created_at DESC LIMIT 1),
          cv.started_at
        ) AS last_message_at,
        (SELECT COUNT(*)::int FROM chat_messages m WHERE m.conversation_id = cv.id) AS message_count
      FROM chat_conversations cv
      LEFT JOIN farmers f ON f.id = cv.farmer_id
      LEFT JOIN users u ON u.id = cv.officer_id
      WHERE ${whereClause}
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const { rows } = await query<ChatConversationRow>(sql, params);
    return res.json({ success: true, data: mapChatConversationRows(rows), limit, offset });
  } catch (error) {
    logger.error('Failed to list conversations:', error);
    return safeError(res, 500, 'Failed to list conversations');
  }
});

/**
 * GET /api/chatbot/conversations/:id/messages — message history for one conversation.
 */
router.get('/conversations/:id/messages', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation id is required' });
    }
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const whereOwner = user.role !== 'admin' && user.role !== 'regional_manager'
      ? 'AND (cv.farmer_id = $2 OR cv.officer_id = $2)'
      : '';
    const params: unknown[] = [conversationId];
    if (whereOwner) {
      const farmerId = user.role === 'farmer' ? await resolveFarmerId(user.userId) : user.userId;
      params.push(farmerId || user.userId);
    }

    const { rows } = await query<ChatMessageRow>(
      `SELECT m.*
         FROM chat_messages m
         JOIN chat_conversations cv ON cv.id = m.conversation_id
        WHERE m.conversation_id = $1 ${whereOwner}
        ORDER BY m.created_at ASC`,
      params
    );
    return res.json({ success: true, data: mapChatMessageRows(rows) });
  } catch (error) {
    logger.error('Failed to list conversation messages:', error);
    return safeError(res, 500, 'Failed to list conversation messages');
  }
});

interface ConversationBody {
  farmer_id?: string;
  farmerId?: string;
  officer_id?: string;
  officerId?: string;
  language?: string;
}

const resolveParticipants = async (user: AuthenticatedRequestUser, body: ConversationBody) => {
  let targetFarmerId = body.farmer_id ?? body.farmerId ?? null;
  let targetOfficerId = body.officer_id ?? body.officerId ?? null;

  if (user.role === 'farmer') {
    targetFarmerId = (await resolveFarmerId(user.userId)) ?? user.userId;
    if (!targetOfficerId) {
      const { rows: fRows } = await query<{ assigned_officer_id: string }>(
        `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
        [targetFarmerId]
      );
      targetOfficerId = fRows[0]?.assigned_officer_id ?? null;
    }
  } else if (user.role === 'extension_officer') {
    targetOfficerId = user.userId;
  } else {
    targetOfficerId = targetOfficerId ?? user.userId;
  }

  return { targetFarmerId, targetOfficerId };
};

const findExistingConversation = async (farmerId: string, officerId: string) => {
  const { rows } = await query<ChatConversationRow>(
    `SELECT cv.*,
            TRIM(CONCAT(f.first_name, ' ', f.last_name)) AS farmer_name,
            f.region AS farmer_region,
            u.name AS officer_name
       FROM chat_conversations cv
       LEFT JOIN farmers f ON f.id = cv.farmer_id
       LEFT JOIN users u ON u.id = cv.officer_id
      WHERE cv.farmer_id = $1 AND cv.officer_id = $2
      ORDER BY cv.started_at DESC NULLS LAST
      LIMIT 1`,
    [farmerId, officerId]
  );
  return rows[0] ?? null;
};

const fetchRichConversation = async (conversationId: string) => {
  const { rows } = await query<ChatConversationRow>(
    `SELECT cv.*,
            TRIM(CONCAT(f.first_name, ' ', f.last_name)) AS farmer_name,
            f.region AS farmer_region,
            u.name AS officer_name
       FROM chat_conversations cv
       LEFT JOIN farmers f ON f.id = cv.farmer_id
       LEFT JOIN users u ON u.id = cv.officer_id
      WHERE cv.id = $1`,
    [conversationId]
  );
  return rows[0] ?? null;
};

/**
 * POST /api/chatbot/conversations — Create or retrieve existing 1-to-1 conversation between Officer & Farmer.
 */
router.post('/conversations', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { targetFarmerId, targetOfficerId } = await resolveParticipants(user, req.body as ConversationBody);

    if (targetFarmerId && targetOfficerId) {
      const existing = await findExistingConversation(targetFarmerId, targetOfficerId);
      if (existing) {
        return res.status(200).json({
          success: true,
          data: mapChatConversationRow(existing),
          isExisting: true,
        });
      }
    }

    const language = (req.body as ConversationBody).language ?? 'en';
    const { rows } = await query<ChatConversationRow>(
      `INSERT INTO chat_conversations (farmer_id, officer_id, language, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [targetFarmerId, targetOfficerId, language]
    );
    const created = rows[0];

    if (created && targetFarmerId) {
      const rich = await fetchRichConversation(created.id);
      if (rich) {
        return res.status(201).json({ success: true, data: mapChatConversationRow(rich) });
      }
    }

    return res.status(201).json({ success: true, data: created ? mapChatConversationRow(created) : null });
  } catch (error) {
    logger.error('Failed to create conversation:', error);
    return safeError(res, 500, 'Failed to create conversation');
  }
});

/**
 * DELETE /api/chatbot/conversations/:id — Delete a conversation and its messages.
 */
router.delete('/conversations/:id', authorize(['admin', 'regional_manager', 'extension_officer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation id is required' });
    }

    let whereClause = 'WHERE id = $1';
    const params: unknown[] = [conversationId];

    if (user.role === 'extension_officer') {
      whereClause += ' AND officer_id = $2';
      params.push(user.userId);
    }

    // Delete associated chat messages first
    await query(`DELETE FROM chat_messages WHERE conversation_id = $1`, [conversationId]);

    // Delete the conversation
    const { rowCount } = await query(`DELETE FROM chat_conversations ${whereClause}`, params);
    if (!rowCount || rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found or not permitted' });
    }

    return res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete conversation:', error);
    return safeError(res, 500, 'Failed to delete conversation');
  }
});

const resolveOrCreateConversation = async (user: AuthenticatedRequestUser, targetFarmerId: string, language?: string) => {
  const officerId = user.role === 'farmer' ? null : user.userId;
  const { rows: existing } = await query<{ id: string }>(
    `SELECT id FROM chat_conversations WHERE farmer_id = $1 AND (officer_id = $2 OR officer_id IS NULL) LIMIT 1`,
    [targetFarmerId, officerId]
  );
  if (existing.length > 0) {
    return existing[0].id;
  }
  const { rows: created } = await query<{ id: string }>(
    `INSERT INTO chat_conversations (farmer_id, officer_id, language, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING id`,
    [targetFarmerId, officerId, language || 'en']
  );
  return created[0]?.id ?? null;
};

/**
 * POST /api/chatbot/message (and /api/chatbot/messages) — Persist message turn from officer or farmer.
 */
const handleMessagePost = async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    const body = req.body as {
      conversation_id?: string;
      conversationId?: string;
      role?: string;
      content?: string;
      message?: string;
      farmerId?: string;
      farmer_id?: string;
      language?: string;
    };

    const content = (body.content || body.message || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    let convId = body.conversation_id ?? body.conversationId;
    const targetFarmerId = body.farmerId ?? body.farmer_id;

    if (!convId && targetFarmerId && user) {
      convId = (await resolveOrCreateConversation(user, targetFarmerId, body.language)) ?? undefined;
    }

    const senderRole = body.role ?? (user?.role === 'farmer' ? 'user' : 'officer');

    const { rows } = await query<ChatMessageRow>(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [convId ?? null, senderRole, content, body.language ?? null]
    );

    if (convId) {
      await query(
        `UPDATE chat_conversations SET started_at = NOW() WHERE id = $1`,
        [convId]
      );
    }

    const created = rows[0];
    return res.status(201).json({ success: true, data: created ? mapChatMessageRow(created) : null });
  } catch (error) {
    logger.error('Failed to persist chat message:', error);
    return safeError(res, 500, 'Failed to persist chat message');
  }
};

router.post('/message', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), handleMessagePost);
router.post('/messages', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), handleMessagePost);

/**
 * POST /api/chatbot/conversations/:id/rate — submit a satisfaction score.
 */
router.post('/conversations/:id/rate', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation id is required' });
    }

    const body = req.body as { rating?: number };
    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'rating must be a number 1-5' });
    }

    await query(
      `UPDATE chat_conversations
          SET satisfaction_score = $1
        WHERE id = $2 AND (farmer_id = $3 OR officer_id = $3)`,
      [rating, conversationId, user.userId]
    );

    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to rate conversation:', error);
    return safeError(res, 500, 'Failed to rate conversation');
  }
});

/**
 * POST /api/chatbot/completions — AI Assistant inference proxy.
 */
router.post('/completions', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const body = req.body as {
      message?: string;
      conversation_id?: string;
      language?: string;
    };
    const rawMessage = body.message?.trim();
    if (!rawMessage) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    // eslint-disable-next-line no-control-regex
    const sanitizedMessage = rawMessage.slice(0, 2000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    await query(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, 'user', $2, $3)`,
      [body.conversation_id ?? null, sanitizedMessage, body.language ?? null]
    );

    const provider = await AIProviderFactory.getProvider();
    const response = await provider.generateText([
      { role: 'system', content: 'You are an agricultural extension assistant.' },
      { role: 'user', content: sanitizedMessage },
    ]);
    const assistantText = (response?.text ?? '').toString().trim() || 'I am sorry, I could not generate a response.';

    await query(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, 'assistant', $2, $3)`,
      [body.conversation_id ?? null, assistantText, body.language ?? null]
    );

    return res.json({
      success: true,
      data: {
        messages: [
          { role: 'user', content: sanitizedMessage },
          { role: 'assistant', content: assistantText },
        ],
      },
    });
  } catch (error) {
    logger.error('Chat completion failed:', error);
    return safeError(res, 500, 'Chat completion failed');
  }
});

/**
 * GET /api/chatbot/stats/overview — 7-day conversation volume + average satisfaction.
 */
router.get('/stats/overview', authorize(['admin', 'regional_manager', 'extension_officer']), async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    const { rows: countRows } = await query<CountRow>(
      "SELECT COUNT(*) AS count FROM chat_conversations WHERE started_at > NOW() - INTERVAL '7 days'"
    );
    const { rows: satRows } = await query<SatisfactionAvgRow>(
      `SELECT AVG(satisfaction_score)::numeric(10,4) AS avg_satisfaction,
              COUNT(satisfaction_score)            AS total_ratings
         FROM chat_conversations
        WHERE satisfaction_score IS NOT NULL`
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
