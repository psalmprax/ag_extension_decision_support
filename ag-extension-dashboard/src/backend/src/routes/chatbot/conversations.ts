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
import { assertConversationAccess, MessageAccessError, resolveFarmerId, resolvePrincipalRegion } from '@/services/messageAccessService';
import { getRealtimeServer } from '@/services/realtimeHub';
import { linkedDemoSql } from '@/services/demoScope';
import { DEFAULT_CONVERSATION_KIND, parseConversationKind, type ConversationKind } from '@/services/chat/conversationKind';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';
import { listAttachments } from '@/services/uploadAttachments';
import { markThreadRead, unreadSummary } from '@/services/chat/readState';
import { isUuid } from '@/utils/uuid';

// Farmer chat, the farmer's "My officer" thread and the officer's AI chats are paid features;
// admins and the demo are exempt (see requirePaidPlan).
const requireChatPlan = requirePaidPlan('chat');

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/**
 * GET /api/chatbot/conversations — Role-based conversation listing.
 * - Admin: sees all conversations across all regional managers, extension officers, and farmers.
 * - Regional Manager: sees all conversations within their region.
 * - Extension Officer: sees all conversations with their assigned farmers (1-to-many).
 * - Farmer: sees their single conversation thread with their extension officer (1-to-1).
 */
/** An officer's (or admin's) own private AI chats; nobody lists anyone else's. */
function ownAiChatScope(user: AuthenticatedRequestUser, params: unknown[]): string {
  params.push(user.userId);
  return `cv.officer_id = $${params.length}`;
}

/** Which farmer threads a role may list. */
async function farmerThreadScope(user: AuthenticatedRequestUser, params: unknown[]): Promise<string> {
  if (user.role === 'admin') return '1=1';
  if (user.role === 'regional_manager') {
    // Scope by the farmer's region, not merely the assigned officer's region.
    params.push((await resolvePrincipalRegion(user.userId)) ?? '');
    return `f.region = $${params.length}`;
  }
  if (user.role === 'farmer') {
    // A farmer sees the thread with their officer (1-to-1).
    params.push((await resolveFarmerId(user.userId)) || user.userId);
    return `(cv.farmer_id = $${params.length} OR cv.officer_id = $${params.length})`;
  }
  // An extension officer sees the threads of their assigned farmers (1-to-many).
  params.push(user.userId);
  return `cv.officer_id = $${params.length}`;
}

router.get('/conversations', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 200);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

    const kind = parseConversationKind(req.query.kind) ?? DEFAULT_CONVERSATION_KIND;
    // Farmers have no private AI chats: asking for them yields an empty list.
    if (user.role === 'farmer' && kind !== 'farmer_thread') {
      return res.json({ success: true, data: [], limit, offset });
    }
    const params: unknown[] = [];
    const scope = kind === 'officer_ai'
      ? ownAiChatScope(user, params)
      : await farmerThreadScope(user, params);
    params.push(kind);
    // Demo conversations only for the demo session; real ones never for it.
    const whereClause = `(${scope}) AND cv.kind = $${params.length} AND ${linkedDemoSql('cv', user)}`;

    params.push(limit);
    params.push(offset);
    const limitParamIdx = params.length - 1;
    const offsetParamIdx = params.length;

    const sql = `
      SELECT 
        cv.id,
        cv.farmer_id,
        cv.officer_id,
        cv.kind,
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
      -- A farmer's thread started from the app has no officer yet; it goes to their assigned officer.
      LEFT JOIN users u ON u.id = COALESCE(cv.officer_id, f.assigned_officer_id)
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
const THREAD_PAGE_SIZE = 200;
const THREAD_PAGE_MAX = 500;

router.get('/conversations/:id/messages', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation id is required' });
    }
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await assertConversationAccess(user, conversationId);

    const whereOwner = user.role !== 'admin' && user.role !== 'regional_manager'
      ? 'AND (cv.farmer_id = $2 OR cv.officer_id = $2)'
      : '';
    const params: unknown[] = [conversationId];
    if (whereOwner) {
      const farmerId = user.role === 'farmer' ? await resolveFarmerId(user.userId) : user.userId;
      params.push(farmerId || user.userId);
    }

    // The latest page of the thread (oldest first), and older pages on request with
    // ?before=<id of the oldest message shown>: a long thread is never sent whole. The
    // cursor is a message id, not a time, because the database keeps microseconds.
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? ''), 10) || THREAD_PAGE_SIZE, 1), THREAD_PAGE_MAX);
    const before = isUuid(req.query.before) ? req.query.before : null;
    params.push(before, limit + 1);
    const beforeParam = `$${params.length - 1}`;
    const limitParam = `$${params.length}`;
    const { rows: newestFirst } = await query<ChatMessageRow>(
      `SELECT m.*
         FROM chat_messages m
         JOIN chat_conversations cv ON cv.id = m.conversation_id
        WHERE m.conversation_id = $1 ${whereOwner}
          AND (${beforeParam}::uuid IS NULL OR (m.created_at, m.id) <
               (SELECT older.created_at, older.id FROM chat_messages older WHERE older.id = ${beforeParam}::uuid))
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ${limitParam}`,
      params
    );
    const hasMore = newestFirst.length > limit;
    const rows = newestFirst.slice(0, limit).reverse();
    const attachments = await listAttachments('chat', rows.map(row => row.id));
    const messages = mapChatMessageRows(rows).map(message => {
      const photos = attachments.get(message.id);
      return photos ? { ...message, attachments: photos } : message;
    });
    return res.json({ success: true, data: messages, hasMore });
  } catch (error) {
    if (error instanceof MessageAccessError) {
      return safeError(res, error.statusCode, error.message);
    }
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
  kind?: string;
}

/** Farmers only start threads; staff name the kind, defaulting to a thread when a farmer is named. */
function kindForNewConversation(user: AuthenticatedRequestUser, body: ConversationBody, targetFarmerId: string | null): ConversationKind {
  if (user.role === 'farmer') return 'farmer_thread';
  return parseConversationKind(body.kind) ?? (targetFarmerId ? 'farmer_thread' : 'officer_ai');
}

const resolveFarmerParticipants = async (user: AuthenticatedRequestUser) => {
  const targetFarmerId = (await resolveFarmerId(user.userId)) ?? user.userId;
  const { rows } = await query<{ assigned_officer_id: string }>(
    `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
    [targetFarmerId]
  );
  return { targetFarmerId, targetOfficerId: rows[0]?.assigned_officer_id ?? null };
};

const resolveOfficerParticipants = async (user: AuthenticatedRequestUser, targetFarmerId: string | null) => {
  if (targetFarmerId) {
    // Officers may only open conversations with farmers assigned to them.
    const { rows } = await query<{ assigned_officer_id: string | null }>(
      `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
      [targetFarmerId]
    );
    if (!rows[0] || rows[0].assigned_officer_id !== user.userId) {
      throw new MessageAccessError('You can only message farmers assigned to you.');
    }
  }
  return { targetFarmerId, targetOfficerId: user.userId };
};

const resolveRegionalManagerParticipants = async (user: AuthenticatedRequestUser, targetFarmerId: string | null) => {
  if (!targetFarmerId) {
    throw new MessageAccessError('A farmer in your region is required.');
  }
  const region = await resolvePrincipalRegion(user.userId);
  const { rows } = await query<{ region: string | null; assigned_officer_id: string | null }>(
    `SELECT region, assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
    [targetFarmerId]
  );
  const farmer = rows[0];
  if (!region || !farmer || farmer.region !== region) {
    throw new MessageAccessError('You can only create conversations within your region.');
  }
  return { targetFarmerId, targetOfficerId: farmer.assigned_officer_id ?? user.userId };
};

const resolveParticipants = async (user: AuthenticatedRequestUser, body: ConversationBody) => {
  const targetFarmerId = body.farmer_id ?? body.farmerId ?? null;
  const targetOfficerId = body.officer_id ?? body.officerId ?? null;

  if (user.role === 'farmer') {
    // A farmer may only converse with their OWN extension officer — never pick
    // an arbitrary officer or farmer (both are forced to the farmer's record).
    return resolveFarmerParticipants(user);
  }
  if (user.role === 'extension_officer') {
    return resolveOfficerParticipants(user, targetFarmerId);
  }
  if (user.role === 'regional_manager') {
    return resolveRegionalManagerParticipants(user, targetFarmerId);
  }
  return { targetFarmerId, targetOfficerId: targetOfficerId ?? user.userId };
};

const findExistingConversation = async (farmerId: string, officerId: string, kind: ConversationKind) => {
  const { rows } = await query<ChatConversationRow>(
    `SELECT cv.*,
            TRIM(CONCAT(f.first_name, ' ', f.last_name)) AS farmer_name,
            f.region AS farmer_region,
            TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS officer_name
       FROM chat_conversations cv
       LEFT JOIN farmers f ON f.id = cv.farmer_id
       LEFT JOIN users u ON u.id = COALESCE(cv.officer_id, f.assigned_officer_id)
      WHERE cv.farmer_id = $1 AND cv.officer_id = $2 AND cv.kind = $3
      ORDER BY cv.started_at DESC NULLS LAST
      LIMIT 1`,
    [farmerId, officerId, kind]
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
       LEFT JOIN users u ON u.id = COALESCE(cv.officer_id, f.assigned_officer_id)
      WHERE cv.id = $1`,
    [conversationId]
  );
  return rows[0] ?? null;
};

/**
 * POST /api/chatbot/conversations — Create or retrieve existing 1-to-1 conversation between Officer & Farmer.
 */
router.post('/conversations', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { targetFarmerId, targetOfficerId } = await resolveParticipants(user, req.body as ConversationBody);
    const kind = kindForNewConversation(user, req.body as ConversationBody, targetFarmerId);

    if (targetFarmerId && targetOfficerId) {
      const existing = await findExistingConversation(targetFarmerId, targetOfficerId, kind);
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
      `INSERT INTO chat_conversations (farmer_id, officer_id, language, status, kind)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING *`,
      [targetFarmerId, targetOfficerId, language, kind]
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
router.delete('/conversations/:id', authorize(['admin', 'regional_manager', 'extension_officer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation id is required' });
    }

    await assertConversationAccess(user, conversationId);

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
    if (error instanceof MessageAccessError) {
      return safeError(res, error.statusCode, error.message);
    }
    logger.error('Failed to delete conversation:', error);
    return safeError(res, 500, 'Failed to delete conversation');
  }
});

/**
 * POST /api/chatbot/conversations/:id/rate — submit a satisfaction score.
 */
router.post('/conversations/:id/rate', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
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
 * GET /api/chatbot/unread — unread messages in the caller's farmer threads
 * (an officer: from their farmers; a farmer: from their officer and the AI).
 */
router.get('/unread', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await unreadSummary(req.user!) });
  } catch (error) {
    logger.error('Unread count failed:', error);
    return safeError(res, 500, 'Unread count failed');
  }
});

/**
 * POST /api/chatbot/conversations/:id/read — the caller has read the thread up
 * to now. Tells the other side (read receipt) and clears the caller's unread.
 */
router.post('/conversations/:id/read', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const convId = req.params.id;
    await markThreadRead(user, convId);
    try {
      getRealtimeServer()?.to(`conversation:${convId}`).emit('messages_read', { conversationId: convId, userId: user.userId, at: new Date().toISOString() });
    } catch (e) { logger.debug('messages_read notify skipped:', e); }
    return res.json({ success: true });
  } catch (e) {
    if (e instanceof MessageAccessError) return safeError(res, e.statusCode, e.message);
    logger.error('Read receipt failed:', e);
    return safeError(res, 500, 'Read failed');
  }
});

/**
 * PUT /api/chatbot/conversations/:id — Rename a conversation the caller
 * participates in. Serves the chat sidebar rename action.
 */
router.put('/conversations/:id', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation id is required' });
    }

    const body = req.body as { title?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 120) {
      return res.status(400).json({ success: false, error: 'title must be 1-120 characters' });
    }

    const { rows } = await query<ChatConversationRow>(
      `UPDATE chat_conversations
          SET title = $1
        WHERE id = $2 AND (farmer_id = $3 OR officer_id = $3)
        RETURNING *`,
      [title, conversationId, user.userId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    return res.json({ success: true, data: mapChatConversationRow(rows[0]) });
  } catch (error) {
    logger.error('Failed to rename conversation:', error);
    return safeError(res, 500, 'Failed to rename conversation');
  }
});

export default router;
