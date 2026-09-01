/**
 * Shared API contract — knowledge base (`/api/v1/knowledge`).
 */
import { z } from 'zod';

export const knowledgeSearchSchema = z.object({
  query: z.string().min(1).max(500),
  category: z.string().optional(),
  crop: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export const knowledgeArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  crops: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  source: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const askKnowledgeSchema = z.object({
  query: z.string().min(1).max(8000),
  category: z.string().optional(),
  crop: z.string().optional(),
  language: z.string().optional(),
});

export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;
export type KnowledgeArticle = z.infer<typeof knowledgeArticleSchema>;
export type AskKnowledge = z.infer<typeof askKnowledgeSchema>;
