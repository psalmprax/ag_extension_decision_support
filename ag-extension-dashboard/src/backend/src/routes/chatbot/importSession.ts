import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { authorize } from '@/middleware/authorize';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import type { AuthenticatedRequestUser } from '@/types/rowTypes';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

const importSessionMessageSchema = z.object({
  id: z.string().optional(),
  sender: z.enum(['user', 'assistant']).optional(),
  role: z.enum(['user', 'assistant']).optional(),
  text: z.string().optional(),
  content: z.string().optional(),
  language: z.string().min(2).max(10).optional().default('en'),
  sourceBadge: z.string().optional(),
  timestamp: z.string().optional(),
});

const importSessionSchema = z.object({
  messages: z
    .array(importSessionMessageSchema)
    .min(1, 'At least one message is required to import a consultation session'),
  entitySlots: z
    .object({
      crop: z.string().nullable().optional(),
      pest_disease: z.string().nullable().optional(),
      field_size: z.string().nullable().optional(),
      location_climate: z.string().nullable().optional(),
      soil_profile: z.string().nullable().optional(),
    })
    .optional()
    .default({}),
});

async function resolveFarmerId(userId: string): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM farmers WHERE user_id = $1 OR id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0]?.id || null;
}

router.post(
  '/import-session',
  authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']),
  validate({ body: importSessionSchema }),
  async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const { messages, entitySlots } = req.body;

      let farmerId: string | null = null;
      let officerId: string | null = null;

      if (user.role === 'farmer') {
        farmerId = (await resolveFarmerId(user.userId)) ?? user.userId;
        const { rows: fRows } = await query<{ assigned_officer_id: string }>(
          `SELECT assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
          [farmerId]
        );
        officerId = fRows[0]?.assigned_officer_id ?? null;
      } else {
        officerId = user.userId;
      }

      const primaryLang = messages.find((m: { language?: string }) => m.language === 'sw')
        ? 'sw'
        : 'en';

      const { rows: convRows } = await query<{ id: string }>(
        `INSERT INTO chat_conversations (farmer_id, officer_id, language, status, started_at)
         VALUES ($1, $2, $3, 'active', NOW())
         RETURNING id`,
        [farmerId, officerId, primaryLang]
      );

      const conversation = convRows[0];
      if (!conversation) {
        return safeError(res, 500, 'Failed to create conversation during import');
      }

      const conversationId = conversation.id;
      let importedCount = 0;

      for (const msg of messages) {
        const textContent = (msg.content || msg.text || '').trim();
        if (!textContent) continue;

        const role = msg.role || (msg.sender === 'assistant' ? 'assistant' : 'user');
        const lang = msg.language || primaryLang;
        const entitiesJson = entitySlots ? JSON.stringify(entitySlots) : null;

        await query(
          `INSERT INTO chat_messages (conversation_id, role, content, language, entities, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [conversationId, role, textContent, lang, entitiesJson]
        );
        importedCount++;
      }

      logger.info('Imported public consultation session', {
        userId: user.userId,
        conversationId,
        importedCount,
      });

      return res.status(201).json({
        success: true,
        data: {
          conversationId,
          importedMessagesCount: importedCount,
          entitySlots,
        },
      });
    } catch (error) {
      logger.error('Failed to import consultation session:', error);
      return safeError(res, 500, 'Failed to import consultation session');
    }
  }
);

export default router;
