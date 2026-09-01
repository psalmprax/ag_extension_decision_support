/**
 * Shared API contract — chatbot / AI chat (`/api/v1/chatbot`).
 */
import { z } from 'zod';
import { uuidSchema } from './helpers';

export const chatbotRoleSchema = z.enum(['user', 'assistant', 'system']);

export const sendChatMessageSchema = z.object({
  message: z.string().min(1).max(8000),
  conversationId: uuidSchema.optional(),
  farmerId: uuidSchema.optional(),
  mode: z.enum(['default', 'extension', 'voice']).optional(),
  agent: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  pageContext: z.unknown().optional(),
  imageData: z.string().optional(),
  file: z.unknown().optional(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: chatbotRoleSchema,
  content: z.string(),
  createdAt: z.string(),
});

export const conversationSchema = z.object({
  id: z.string(),
  farmerId: z.string().nullable().optional(),
  officerId: z.string().nullable().optional(),
  language: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
});

export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
