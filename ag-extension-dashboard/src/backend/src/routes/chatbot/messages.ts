import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import type {
  ChatMessageRow,
  AuthenticatedRequestUser,
} from '@/types/rowTypes';
import {
  mapChatMessageRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
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
 * Enforce message write-scope for chat turns:
 *  - An extension officer posting to a new farmer must have that farmer assigned.
 *  - A farmer posting to an explicit conversation must own it.
 */
async function assertChatWriteAllowed(
  user: AuthenticatedRequestUser,
  targetFarmerId: string | undefined,
  conversationId: string | undefined
): Promise<void> {
  if (user.role === 'extension_officer' && targetFarmerId) {
    const { rows: fRows } = await query<{ assigned_officer_id: string | null }>(
      `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
      [targetFarmerId]
    );
    if (!fRows[0] || fRows[0].assigned_officer_id !== user.userId) {
      throw new MessageAccessError('You can only message farmers assigned to you.');
    }
  }
  if (user.role === 'farmer' && conversationId) {
    const ownFarmerId = (await resolveFarmerId(user.userId)) ?? user.userId;
    const { rows: cRows } = await query<{ farmer_id: string | null }>(
      `SELECT farmer_id FROM chat_conversations WHERE id = $1 LIMIT 1`,
      [conversationId]
    );
    if (!cRows[0] || cRows[0].farmer_id !== ownFarmerId) {
      throw new MessageAccessError('You can only message your extension officer.');
    }
  }
}

/**
 * Determine the target conversation for a posted message after enforcing the
 * write-scope rule for the caller's role.
 */
async function resolveConversationIdForPost(
  user: AuthenticatedRequestUser | undefined,
  targetFarmerId: string | undefined,
  requestedConversationId: string | undefined,
  language: string | undefined
): Promise<string | undefined> {
  if (!user) return requestedConversationId;
  await assertChatWriteAllowed(user, targetFarmerId, requestedConversationId);
  if (!requestedConversationId && targetFarmerId) {
    return (await resolveOrCreateConversation(user, targetFarmerId, language)) ?? undefined;
  }
  return requestedConversationId;
}

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

/** Best-effort realtime fanout of a persisted chat turn to its conversation room. */
async function fanoutNewMessage(conversationId: string, message: ChatMessageRow): Promise<void> {
  try {
    getRealtimeServer()?.to(`conversation:${conversationId}`).emit('new_message', mapChatMessageRow(message));
  } catch { /* socket fanout is best-effort */ }
}

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

    const targetFarmerId = body.farmerId ?? body.farmer_id;
    const conversationId = await resolveConversationIdForPost(user, targetFarmerId, body.conversation_id ?? body.conversationId, body.language);

    const senderRole = body.role ?? (user?.role === 'farmer' ? 'user' : 'officer');

    const { rows } = await query<ChatMessageRow>(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [conversationId ?? null, senderRole, content, body.language ?? null]
    );

    if (conversationId) {
      await query(
        `UPDATE chat_conversations SET started_at = NOW() WHERE id = $1`,
        [conversationId]
      );
    }

    const created = rows[0];
    if (created && conversationId) {
      await fanoutNewMessage(conversationId, created);
    }
    return res.status(201).json({ success: true, data: created ? mapChatMessageRow(created) : null });
  } catch (error) {
    if (error instanceof MessageAccessError) {
      return safeError(res, error.statusCode, error.message);
    }
    logger.error('Failed to persist chat message:', error);
    return safeError(res, 500, 'Failed to persist chat message');
  }
};

router.post('/message', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), handleMessagePost);
router.post('/messages', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), handleMessagePost);

/**
 * PATCH /api/chatbot/messages/:id — Edit own message (officer/farmer) within 15m.
 */
router.patch('/messages/:id', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const msgId = req.params.id;
    const { content } = req.body as { content?: string };
    const next = (content || '').trim().slice(0, 2000);
    if (!next) return res.status(400).json({ success: false, error: 'content required' });
    const { rows } = await query<ChatMessageRow>(`SELECT m.* FROM chat_messages m JOIN chat_conversations cv ON cv.id=m.conversation_id WHERE m.id=$1`, [msgId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Message not found' });
    const isOwner = rows[0].role === (user.role === 'farmer' ? 'user' : 'officer') || user.role === 'admin';
    if (!isOwner) return res.status(403).json({ success: false, error: 'Not owner' });
    const createdAt = rows[0].created_at ? new Date(rows[0].created_at as string).getTime() : 0;
    if (Date.now() - createdAt > 15 * 60 * 1000) return res.status(403).json({ success: false, error: 'Edit window expired (15m)' });
    const { rows: updated } = await query<ChatMessageRow>(`UPDATE chat_messages SET content=$1, metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb WHERE id=$3 RETURNING *`, [next, JSON.stringify({ editedAt: new Date().toISOString() }), msgId]);
    if (updated[0]) await fanoutNewMessage(updated[0].conversation_id!, updated[0]);
    return res.json({ success: true, data: updated[0] ? mapChatMessageRow(updated[0]) : null });
  } catch (e) { logger.error('Edit message failed:', e); return safeError(res, 500, 'Edit failed'); }
});

/**
 * DELETE /api/chatbot/messages/:id — Soft delete own message.
 */
router.delete('/messages/:id', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const msgId = req.params.id;
    const { rows } = await query<ChatMessageRow>(`SELECT m.* FROM chat_messages m JOIN chat_conversations cv ON cv.id=m.conversation_id WHERE m.id=$1`, [msgId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Message not found' });
    const isOwner = rows[0].role === (user.role === 'farmer' ? 'user' : 'officer') || user.role === 'admin';
    if (!isOwner) return res.status(403).json({ success: false, error: 'Not owner' });
    const { rows: updated } = await query<ChatMessageRow>(`UPDATE chat_messages SET content='[deleted]', metadata=COALESCE(metadata,'{}'::jsonb) || $1::jsonb WHERE id=$2 RETURNING *`, [JSON.stringify({ deletedAt: new Date().toISOString(), deletedBy: user.userId }), msgId]);
    if (updated[0]) await fanoutNewMessage(updated[0].conversation_id!, updated[0]);
    return res.json({ success: true });
  } catch (e) { logger.error('Delete message failed:', e); return safeError(res, 500, 'Delete failed'); }
});

export default router;
