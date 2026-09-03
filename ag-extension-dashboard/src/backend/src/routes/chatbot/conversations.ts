import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import type {
  ChatConversationRow,
  ChatMessageRow,
  AuthenticatedRequestUser,
} from '@/types/rowTypes';
import {
  mapChatMessageRows,
  mapChatConversationRows,
  mapChatConversationRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { MessageAccessError } from '@/services/messageAccessService';
import { getRealtimeServer } from '@/services/realtimeHub';

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
      const region = user.region || (await (async () => {
        try {
          const { resolvePrincipalRegion } = await import('@/services/messageAccessService');
          return await resolvePrincipalRegion(user.userId);
        } catch { return ''; }
      })()) || '';
      params.push(region);
      params.push(user.userId);
      whereClause = `(u.region = $1 OR f.region = $1 OR cv.officer_id = $2)`;
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
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS officer_name,
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
    // A farmer may only converse with their OWN extension officer — never pick
    // an arbitrary officer or farmer (both are forced to the farmer's record).
    targetFarmerId = (await resolveFarmerId(user.userId)) ?? user.userId;
    const { rows: fRows } = await query<{ assigned_officer_id: string }>(
      `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
      [targetFarmerId]
    );
    targetOfficerId = fRows[0]?.assigned_officer_id ?? null;
  } else if (user.role === 'extension_officer') {
    targetOfficerId = user.userId;
    if (targetFarmerId) {
      // Officers may only open conversations with farmers assigned to them.
      const { rows: fRows } = await query<{ assigned_officer_id: string | null }>(
        `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
        [targetFarmerId]
      );
      if (!fRows[0] || fRows[0].assigned_officer_id !== user.userId) {
        throw new MessageAccessError('You can only message farmers assigned to you.');
      }
    }
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
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS officer_name
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
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS officer_name
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
    if (error instanceof MessageAccessError) {
      return safeError(res, error.statusCode, error.message);
    }
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
 * POST /api/chatbot/conversations/:id/read — Mark conversation as read (receipt).
 */
router.post('/conversations/:id/read', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const convId = req.params.id;
    await query(`UPDATE chat_conversations SET ended_at = NOW() WHERE id = $1 AND (farmer_id = $2 OR officer_id = $2)`, [convId, user.userId]);
    try {
      getRealtimeServer()?.to(`conversation:${convId}`).emit('messages_read', { conversationId: convId, userId: user.userId, at: new Date().toISOString() });
    } catch (e) { logger.debug('messages_read notify skipped:', e); }
    return res.json({ success: true });
  } catch (e) { logger.error('Read receipt failed:', e); return safeError(res, 500, 'Read failed'); }
});

export default router;
