import { z } from 'zod';
import { isoStringSchema } from './helpers';

export const commercialKnowledgeArticleSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    summary: z.string().optional(),
    category: z.string(),
    tags: z.array(z.string()),
    crops: z.array(z.string()),
    regions: z.array(z.string()),
    source: z.string(),
    sourceUrl: z.string().url().optional(),
    author: z.string().optional(),
    publishedAt: isoStringSchema.optional(),
    language: z.string().optional().default('en'),
    isPremium: z.boolean().optional().default(false),
    accessLevel: z.enum(['free', 'pro', 'enterprise']).optional().default('free'),
});

export const commercialKnowledgeSearchSchema = z.object({
    query: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    crops: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    accessLevel: z.enum(['free', 'pro', 'enterprise']).optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
    sortBy: z.enum(['relevance', 'date', 'popularity']).optional().default('relevance'),
});

export const commercialKnowledgeArticleDetailSchema = commercialKnowledgeArticleSchema.extend({
    relatedArticles: z.array(z.object({
        id: z.string(),
        title: z.string(),
    })).optional(),
    views: z.number().int().min(0).optional(),
    downloads: z.number().int().min(0).optional(),
    rating: z.number().min(0).max(5).optional(),
});

export type CommercialKnowledgeArticle = z.infer<typeof commercialKnowledgeArticleSchema>;
export type CommercialKnowledgeSearchParams = z.infer<typeof commercialKnowledgeSearchSchema>;
export type CommercialKnowledgeArticleDetail = z.infer<typeof commercialKnowledgeArticleDetailSchema>;