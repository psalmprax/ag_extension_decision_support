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

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/**
 * POST /api/chatbot/messages — persist a single chat turn.
 * The Prisma `ChatMessage` model stores role + content + language metadata.
 */
router.post('/messages', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: Request, res: Response) => {
    try {
        const body = req.body as {
            conversation_id?: string;
            role?: string;
            content?: string;
        };
        if (!body.role || !body.content) {
            return res.status(400).json({ success: false, error: 'role and content are required' });
        }
        const { rows } = await query<ChatMessageRow>(
            `INSERT INTO chat_messages (conversation_id, role, content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [body.conversation_id ?? null, body.role, body.content]
        );
        const created = rows[0];
        return res.status(201).json({ success: true, data: created ? mapChatMessageRow(created) : null });
    } catch (error) {
        logger.error('Failed to persist chat message:', error);
        return safeError(res, 500, 'Failed to persist chat message');
    }
});

/**
 * GET /api/chatbot/conversations — paginated conversation history for the caller.
 * Joins farmerId from the JWT into the where clause via officerId/farmerId columns.
 */
router.get('/conversations', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
        const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

        const column = user.role === 'farmer' ? 'farmer_id' : 'officer_id';
        const { rows } = await query<ChatConversationRow>(
            `SELECT * FROM chat_conversations
              WHERE ${column} = $1
              ORDER BY started_at DESC NULLS LAST
              LIMIT $2 OFFSET $3`,
            [user.userId, limit, offset]
        );
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

        // Officers/farmers can only read their own conversation messages.
        const whereOwner = user && user.role !== 'admin' && user.role !== 'regional_manager'
            ? 'AND (cv.farmer_id = $2 OR cv.officer_id = $2)'
            : '';
        const params: unknown[] = [conversationId];
        if (whereOwner) params.push(user?.userId ?? '');

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

/**
 * POST /api/chatbot/conversations/:id/rate — submit a satisfaction score.
 * Maps to the Prisma `satisfactionScore` column (1-5).
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
 * POST /api/chatbot/conversations — start a new conversation row.
 * Schema has farmer_id / officer_id / language / status (no `title` or `user_id`).
 */
router.post('/conversations', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const body = req.body as { language?: string };

        const farmerId = user.role === 'farmer' ? user.userId : null;
        const officerId = user.role !== 'farmer' ? user.userId : null;

        const { rows } = await query<ChatConversationRow>(
            `INSERT INTO chat_conversations (farmer_id, officer_id, language, status)
             VALUES ($1, $2, $3, 'active')
             RETURNING *`,
            [farmerId, officerId, body.language ?? null]
        );
        const created = rows[0];
        return res.status(201).json({ success: true, data: created ? mapChatConversationRow(created) : null });
    } catch (error) {
        logger.error('Failed to create conversation:', error);
        return safeError(res, 500, 'Failed to create conversation');
    }
});

/**
 * POST /api/chatbot/completions — inference proxy. Persists user + assistant turns
 * and dispatches to the configured AI provider via AIProviderFactory.
 */
router.post('/completions', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthedRequest, res: Response) => {
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

        // Persist the user turn up front so a crash mid-inference still records it.
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
