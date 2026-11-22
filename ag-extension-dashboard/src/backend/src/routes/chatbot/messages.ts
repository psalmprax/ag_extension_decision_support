import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import { draftProvenance, scheduleDraftCorrectionReview } from '@/services/chat/draftProvenance';
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
import { assertConversationAccess, checkMessageAccess, MessageAccessError, resolveFarmerId } from '@/services/messageAccessService';
import { respondIfUrgent } from '@/services/chat/threadAutoReply';
import { afterOfficerReply, fanoutNewMessage, isMessageAuthor, senderMetadata } from '@/services/chat/threadPost';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';
import {
  AttachmentError,
  assertAttachableImages,
  linkAttachments,
  listAttachments,
  parseAttachmentIds,
} from '@/services/uploadAttachments';

// Farmer chat, the farmer's "My officer" thread and the officer's AI chats are paid features;
// admins and the demo are exempt (see requirePaidPlan).
const requireChatPlan = requirePaidPlan('chat');

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

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
  if (user.role === 'regional_manager' && targetFarmerId) {
    await checkMessageAccess(user, { farmerId: targetFarmerId });
  }
  if (conversationId) {
    await assertConversationAccess(user, conversationId);
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
    `SELECT id FROM chat_conversations
      WHERE farmer_id = $1 AND (officer_id = $2 OR officer_id IS NULL) AND kind = 'farmer_thread'
      LIMIT 1`,
    [targetFarmerId, officerId]
  );
  if (existing.length > 0) {
    return existing[0].id;
  }
  const { rows: created } = await query<{ id: string }>(
    `INSERT INTO chat_conversations (farmer_id, officer_id, language, status, kind)
     VALUES ($1, $2, $3, 'active', 'farmer_thread')
     RETURNING id`,
    [targetFarmerId, officerId, language || 'en']
  );
  return created[0]?.id ?? null;
};

/** Best-effort realtime fanout of a persisted chat turn to its conversation room. */
/** A farmer's urgent message gets safety steps right away; the turn-taking job is the backstop. */
function scheduleUrgentCheck(conversationId: string): void {
  setImmediate(() => {
    respondIfUrgent(conversationId).catch(error => logger.warn('Urgent safety reply failed:', error));
  });
}

/** Stored as the text of a message that is only a photo. */
const PHOTO_ONLY_CONTENT = 'Shared a photo';

async function conversationFarmerId(conversationId: string): Promise<string | null> {
  const { rows } = await query<{ farmer_id: string | null }>(
    'SELECT farmer_id FROM chat_conversations WHERE id = $1',
    [conversationId]
  );
  return rows[0]?.farmer_id ?? null;
}

/** Photos may only go into a farmer conversation, and must be the sender's uploads for that farmer. */
async function assertMessagePhotos(attachmentIds: string[], senderId: string | undefined, conversationId: string | null | undefined): Promise<void> {
  if (attachmentIds.length === 0) return;
  const threadFarmerId = conversationId ? await conversationFarmerId(conversationId) : null;
  if (!threadFarmerId || !senderId) throw new AttachmentError('Photos can only be sent in a farmer conversation');
  await assertAttachableImages(attachmentIds, senderId, threadFarmerId);
}

async function messageWithPhotos(row: ChatMessageRow, attachmentIds: string[]) {
  const attachments = attachmentIds.length > 0 ? (await listAttachments('chat', [row.id])).get(row.id) : undefined;
  return { ...mapChatMessageRow(row), ...(attachments ? { attachments } : {}) };
}

/**
 * Store a message from the signed-in user. An officer's reply that began as the
 * copilot's AI draft is marked as such, and an edited draft goes to review.
 */
async function insertThreadMessage(params: {
  conversationId: string | null | undefined;
  senderRole: 'user' | 'officer';
  content: string;
  language?: string;
  senderId?: string;
  aiDraft?: unknown;
}): Promise<ChatMessageRow[]> {
  const { conversationId, senderRole, content, senderId } = params;
  const fromDraft = senderRole === 'officer' && conversationId ? draftProvenance(params.aiDraft, content) : null;
  const { rows } = await query<ChatMessageRow>(
    `INSERT INTO chat_messages (conversation_id, role, content, language, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [conversationId ?? null, senderRole, content, params.language ?? null,
     senderMetadata(senderId, fromDraft ? { aiDraft: { edited: fromDraft.edited } } : {})]
  );
  if (fromDraft?.edited && conversationId && senderId) {
    scheduleDraftCorrectionReview({ conversationId, officerId: senderId, draft: fromDraft.draft, sent: content });
  }
  return rows;
}

const handleMessagePost = async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    const body = req.body as {
      conversation_id?: string;
      conversationId?: string;
      content?: string;
      message?: string;
      farmerId?: string;
      farmer_id?: string;
      language?: string;
      attachmentIds?: unknown;
      /** The copilot draft this reply started from (officers only). */
      aiDraft?: { text?: unknown };
    };

    const attachmentIds = parseAttachmentIds(body.attachmentIds);
    const typed = (body.content || body.message || '').trim();
    if (!typed && attachmentIds.length === 0) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    // A photo sent without a caption still reads sensibly in previews and on SMS.
    const content = typed || PHOTO_ONLY_CONTENT;

    const targetFarmerId = body.farmerId ?? body.farmer_id;
    const conversationId = await resolveConversationIdForPost(user, targetFarmerId, body.conversation_id ?? body.conversationId, body.language);
    await assertMessagePhotos(attachmentIds, user?.userId, conversationId);

    // The sender is whoever is signed in. A client can never post as the AI,
    // as an officer, or as the farmer.
    const senderRole = user?.role === 'farmer' ? 'user' : 'officer';
    const rows = await insertThreadMessage({
      conversationId, senderRole, content, language: body.language, senderId: user?.userId, aiDraft: body.aiDraft?.text,
    });

    if (conversationId) {
      await query(
        `UPDATE chat_conversations SET started_at = NOW() WHERE id = $1`,
        [conversationId]
      );
    }

    const created = rows[0];
    if (created && attachmentIds.length > 0) {
      await linkAttachments('chat', created.id, attachmentIds);
    }
    if (created && conversationId) {
      if (senderRole === 'user') {
        fanoutNewMessage(conversationId, created);
        scheduleUrgentCheck(conversationId);
      } else {
        afterOfficerReply(conversationId, created);
      }
    }
    return res.status(201).json({ success: true, data: created ? await messageWithPhotos(created, attachmentIds) : null });
  } catch (error) {
    if (error instanceof MessageAccessError || error instanceof AttachmentError) {
      return safeError(res, error.statusCode, error.message);
    }
    logger.error('Failed to persist chat message:', error);
    return safeError(res, 500, 'Failed to persist chat message');
  }
};

// A plain message between people: no AI is involved, so no AI quota is used.
router.post('/message', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, handleMessagePost);
router.post('/messages', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, handleMessagePost);

/**
 * PATCH /api/chatbot/messages/:id — Edit own message (officer/farmer) within 15m.
 */
router.patch('/messages/:id', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const msgId = req.params.id;
    const { content } = req.body as { content?: string };
    const next = (content || '').trim().slice(0, 2000);
    if (!next) return res.status(400).json({ success: false, error: 'content required' });
    const { rows } = await query<ChatMessageRow>(`SELECT m.* FROM chat_messages m JOIN chat_conversations cv ON cv.id=m.conversation_id WHERE m.id=$1`, [msgId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Message not found' });
    if (rows[0].conversation_id) {
      await assertConversationAccess(user, rows[0].conversation_id);
    } else if (user.role !== 'admin') {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    const isOwner = isMessageAuthor(rows[0], user);
    if (!isOwner) return res.status(403).json({ success: false, error: 'Not owner' });
    const createdAt = rows[0].created_at ? new Date(rows[0].created_at as string).getTime() : 0;
    if (Date.now() - createdAt > 15 * 60 * 1000) return res.status(403).json({ success: false, error: 'Edit window expired (15m)' });
    const { rows: updated } = await query<ChatMessageRow>(`UPDATE chat_messages SET content=$1, metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb WHERE id=$3 RETURNING *`, [next, JSON.stringify({ editedAt: new Date().toISOString() }), msgId]);
    if (updated[0]) await fanoutNewMessage(updated[0].conversation_id!, updated[0]);
    return res.json({ success: true, data: updated[0] ? mapChatMessageRow(updated[0]) : null });
  } catch (e) {
    if (e instanceof MessageAccessError) return safeError(res, e.statusCode, e.message);
    logger.error('Edit message failed:', e);
    return safeError(res, 500, 'Edit failed');
  }
});

/**
 * DELETE /api/chatbot/messages/:id — Soft delete own message.
 */
router.delete('/messages/:id', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requireChatPlan, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const msgId = req.params.id;
    const { rows } = await query<ChatMessageRow>(`SELECT m.* FROM chat_messages m JOIN chat_conversations cv ON cv.id=m.conversation_id WHERE m.id=$1`, [msgId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Message not found' });
    if (rows[0].conversation_id) {
      await assertConversationAccess(user, rows[0].conversation_id);
    } else if (user.role !== 'admin') {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    const isOwner = isMessageAuthor(rows[0], user);
    if (!isOwner) return res.status(403).json({ success: false, error: 'Not owner' });
    const { rows: updated } = await query<ChatMessageRow>(`UPDATE chat_messages SET content='[deleted]', metadata=COALESCE(metadata,'{}'::jsonb) || $1::jsonb WHERE id=$2 RETURNING *`, [JSON.stringify({ deletedAt: new Date().toISOString(), deletedBy: user.userId }), msgId]);
    // A withdrawn message takes its photos with it.
    await query('DELETE FROM chat_message_attachments WHERE message_id = $1', [msgId]);
    if (updated[0]) await fanoutNewMessage(updated[0].conversation_id!, updated[0]);
    return res.json({ success: true });
  } catch (e) {
    if (e instanceof MessageAccessError) return safeError(res, e.statusCode, e.message);
    logger.error('Delete message failed:', e);
    return safeError(res, 500, 'Delete failed');
  }
});

export default router;
