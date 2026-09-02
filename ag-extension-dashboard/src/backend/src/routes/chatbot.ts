import { Router, Request, Response } from 'express';
import { AIRouter } from '@/services/aiProvider/aiProvider';
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
import { MessageAccessError } from '@/services/messageAccessService';
import { RAGV2Service } from '@/services/ragV2Service';
import { mcpAdapter } from '@/services/mcpAdapter';

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
    type IoHandle = { io?: { to: (room: string) => { emit: (ev: string, data: unknown) => void } } };
    const mod = await import('@/index').catch(() => ({}) as IoHandle);
    const ioHandle = (mod as IoHandle).io;
    ioHandle?.to(`conversation:${conversationId}`).emit('new_message', mapChatMessageRow(message));
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

/** Load the last turns of a conversation as a context block (empty when none/unavailable). */
async function loadHistoryBlock(conversationId?: string): Promise<string> {
  if (!conversationId) return '';
  try {
    const { rows } = await query<ChatMessageRow>(
      `SELECT role, content FROM chat_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC LIMIT 10`,
      [conversationId]
    );
    const history = rows.reverse().map(m => `${m.role}: ${String(m.content).slice(0, 300)}`).join('\n');
    return history ? `\n\nRECENT CONVERSATION:\n${history}` : '';
  } catch (err) {
    logger.warn('Failed to load chat history for completions:', err);
    return '';
  }
}

/** Retrieve grounded knowledge-base context via RAG v2 enhanced search (empty on failure). */
async function loadRagBlock(message: string): Promise<{ context: string; citations: string[] }> {
  try {
    const { results, citations } = await RAGV2Service.enhancedSearch(message, {
      limit: 3,
      useChunks: true,
      useGraph: true,
      useReranking: true,
    });
    if (results.length === 0) return { context: '', citations: [] };
    const snippets = results
      .map((doc, i) => {
        const title = typeof doc.metadata?.title === 'string' ? doc.metadata.title : 'Knowledge article';
        return `[${i + 1}] ${title}: ${String(doc.content).slice(0, 400)}`;
      })
      .join('\n');
    const citationList = citations.map(c => `${c.title} (${c.category})`);
    return {
      context: `\n\nKNOWLEDGE BASE CONTEXT (cite sources when used):\n${snippets}`,
      citations: citationList
    };
  } catch (err) {
    logger.warn('RAG v2 retrieval failed for chat completions, continuing without context:', err);
    return { context: '', citations: [] };
  }
}

/**
 * POST /api/chatbot/completions — AI Assistant inference proxy with RAG, tools, and history.
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

    // Fetch context in parallel: history + RAG
    const [historyBlock, ragResult] = await Promise.all([
      loadHistoryBlock(body.conversation_id),
      loadRagBlock(sanitizedMessage),
    ]);

    // Persist user message
    await query(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, 'user', $2, $3)`,
      [body.conversation_id ?? null, sanitizedMessage, body.language ?? null]
    );

    // Build system prompt with available tools
    const toolDefinitions = mcpAdapter.convertToMCPTools().map((t: { name: string; description: string; inputSchema: Record<string, unknown> }) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const systemPrompt = `You are an agricultural extension advisory assistant. Answer the farmer's or officer's message using the knowledge base context when relevant. You have access to specialized agricultural tools — use them when they can provide accurate, data-driven information. Be concise and actionable.${historyBlock}${ragResult.context}`;

    // First pass: let the LLM decide if it needs tools
    const response = await AIRouter.routeRequest('generate', {
      prompt: `${systemPrompt}\n\nMESSAGE: ${sanitizedMessage}`,
      options: {
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        temperature: 0.2,
      },
    });

    let assistantText = (response?.text ?? '').toString().trim();

    // If the model requested tool calls, execute them
    if (response?.toolCalls && response.toolCalls.length > 0) {
      const toolResults: string[] = [];
      for (const toolCall of response.toolCalls) {
        try {
          const toolResult = await mcpAdapter.callTool(toolCall.function.name, toolCall.function.arguments);
          toolResults.push(`Tool ${toolCall.function.name} result: ${toolResult.content[0]?.text || 'No output'}`);
        } catch (toolErr) {
          logger.error(`Tool ${toolCall.function.name} execution failed:`, toolErr);
          toolResults.push(`Tool ${toolCall.function.name} error: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`);
        }
      }

      // Second pass: feed tool results back to the model
      const followUpPrompt = `${systemPrompt}\n\nMESSAGE: ${sanitizedMessage}\n\nTOOL RESULTS:\n${toolResults.join('\n')}\n\nNow provide a comprehensive answer using the tool results.`;
      const followUp = await AIRouter.routeRequest('generate', {
        prompt: followUpPrompt,
        options: { temperature: 0.2 },
      });
      assistantText = (followUp?.text ?? '').toString().trim() || assistantText;
    }

    if (!assistantText) {
      assistantText = 'I am sorry, I could not generate a response.';
    }

    // Persist assistant message
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
        citations: ragResult.citations,
        usedTools: response?.toolCalls?.map((tc: { function: { name: string } }) => tc.function.name) || [],
      },
    });
  } catch (error) {
    logger.error('Chat completion failed:', error);
    return safeError(res, 500, 'Chat completion failed');
  }
});

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

/**
 * POST /api/chatbot/conversations/:id/read — Mark conversation as read (receipt).
 */
router.post('/conversations/:id/read', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const convId = req.params.id;
    await query(`UPDATE chat_conversations SET ended_at = NOW() WHERE id = $1 AND (farmer_id = $2 OR officer_id = $2)`, [convId, user.userId]);
    try {
      const mod = await import('@/index').catch(() => ({}) as { io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } });
      (mod as { io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }).io?.to(`conversation:${convId}`).emit('messages_read', { conversationId: convId, userId: user.userId, at: new Date().toISOString() });
    } catch {}
    return res.json({ success: true });
  } catch (e) { logger.error('Read receipt failed:', e); return safeError(res, 500, 'Read failed'); }
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
