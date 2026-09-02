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
    language: z.string().optional(),
    createdAt: z.string(),
});

export const conversationSchema = z.object({
    id: z.string(),
    farmerId: z.string().nullable().optional(),
    officerId: z.string().nullable().optional(),
    language: z.string().optional(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    messageCount: z.number().int().min(0).optional(),
    lastMessageAt: z.string().optional(),
});

export const conversationListSchema = z.object({
    conversations: z.array(conversationSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
});

export const conversationMessagesSchema = z.object({
    messages: z.array(chatMessageSchema),
    total: z.number().int().min(0),
    conversationId: z.string(),
});

export const chatCompletionSchema = z.object({
    message: z.string().min(1).max(8000),
    conversationId: uuidSchema.optional(),
    language: z.string().min(2).max(10).optional(),
});

export const chatCompletionResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        messages: z.array(z.object({
            role: chatbotRoleSchema,
            content: z.string(),
        })),
        citations: z.array(z.string()).optional(),
        usedTools: z.array(z.string()).optional(),
    }).optional(),
    error: z.string().optional(),
});

export const chatRatingSchema = z.object({
    messageId: z.string(),
    rating: z.number().min(1).max(5),
    feedback: z.string().optional(),
});

export const chatStatsSchema = z.object({
    totalConversations: z.number().int().min(0),
    totalMessages: z.number().int().min(0),
    avgRating: z.number().min(0).max(5).optional(),
    activeUsers: z.number().int().min(0).optional(),
});

export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationList = z.infer<typeof conversationListSchema>;
export type ConversationMessages = z.infer<typeof conversationMessagesSchema>;
export type ChatCompletionInput = z.infer<typeof chatCompletionSchema>;
export type ChatCompletionResponse = z.infer<typeof chatCompletionResponseSchema>;
export type ChatRating = z.infer<typeof chatRatingSchema>;
export type ChatStats = z.infer<typeof chatStatsSchema>;