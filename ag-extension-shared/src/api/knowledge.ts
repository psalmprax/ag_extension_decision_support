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
    v2: z.boolean().optional(),
    useCache: z.boolean().optional(),
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
    contentType: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    embedding: z.array(z.number()).optional(),
});

export const knowledgeArticleDetailSchema = knowledgeArticleSchema.extend({
    relatedArticles: z.array(z.object({
        id: z.string(),
        title: z.string(),
    })).optional(),
    views: z.number().int().min(0).optional(),
    rating: z.number().min(0).max(5).optional(),
});

export const knowledgeListSchema = z.object({
    articles: z.array(knowledgeArticleSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
});

export const askKnowledgeSchema = z.object({
    query: z.string().min(1).max(8000),
    category: z.string().optional(),
    crop: z.string().optional(),
    language: z.string().optional(),
    conversationId: z.string().optional(),
});

export const askKnowledgeResponseSchema = z.object({
    answer: z.string(),
    citations: z.array(z.object({
        id: z.string(),
        title: z.string(),
        category: z.string(),
        relevanceScore: z.number().min(0).max(1).optional(),
    })).optional(),
    sources: z.array(z.string()).optional(),
});

export const knowledgeSearchExternalSchema = z.object({
    query: z.string().min(1).max(500),
    source: z.enum(['fao', 'cabi', 'cgiar', 'iita', 'all']).optional(),
    limit: z.number().int().min(1).max(20).optional().default(10),
});

export const knowledgeMetaCategoriesSchema = z.object({
    categories: z.array(z.object({
        name: z.string(),
        count: z.number().int().min(0),
    })),
});

export const knowledgeMetaCropsSchema = z.object({
    crops: z.array(z.object({
        name: z.string(),
        count: z.number().int().min(0),
    })),
});

export const knowledgeHistorySchema = z.object({
    searches: z.array(z.object({
        query: z.string(),
        timestamp: z.string(),
        resultsCount: z.number().int().min(0),
    })),
    total: z.number().int().min(0),
});

export const knowledgeStatsSchema = z.object({
    totalArticles: z.number().int().min(0),
    totalCategories: z.number().int().min(0),
    totalCrops: z.number().int().min(0),
    totalRegions: z.number().int().min(0),
    totalSearches: z.number().int().min(0),
    avgSearchLatencyMs: z.number().optional(),
});

export const knowledgeReorderSchema = z.object({
    ids: z.array(z.string()),
});

export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;
export type KnowledgeArticle = z.infer<typeof knowledgeArticleSchema>;
export type KnowledgeArticleDetail = z.infer<typeof knowledgeArticleDetailSchema>;
export type KnowledgeList = z.infer<typeof knowledgeListSchema>;
export type AskKnowledge = z.infer<typeof askKnowledgeSchema>;
export type AskKnowledgeResponse = z.infer<typeof askKnowledgeResponseSchema>;
export type KnowledgeSearchExternal = z.infer<typeof knowledgeSearchExternalSchema>;
export type KnowledgeMetaCategories = z.infer<typeof knowledgeMetaCategoriesSchema>;
export type KnowledgeMetaCrops = z.infer<typeof knowledgeMetaCropsSchema>;
export type KnowledgeHistory = z.infer<typeof knowledgeHistorySchema>;
export type KnowledgeStats = z.infer<typeof knowledgeStatsSchema>;
export type KnowledgeReorder = z.infer<typeof knowledgeReorderSchema>;