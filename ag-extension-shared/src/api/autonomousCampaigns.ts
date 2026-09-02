import { z } from 'zod';
import { isoStringSchema } from './helpers';

export const campaignGoalSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    targetCrop: z.string().optional(),
    targetRegion: z.string().optional(),
    targetAudience: z.enum(['farmers', 'extension_officers', 'both']).optional().default('farmers'),
    channels: z.array(z.enum(['sms', 'whatsapp', 'voice', 'email', 'push'])).optional().default(['sms']),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'seasonal']).optional().default('weekly'),
    startDate: isoStringSchema.optional(),
    endDate: isoStringSchema.optional(),
    language: z.string().optional().default('en'),
    customPrompt: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
});

export const campaignSchema = campaignGoalSchema.extend({
    id: z.string(),
    status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'failed']),
    createdAt: isoStringSchema,
    updatedAt: isoStringSchema,
    createdBy: z.string(),
    stats: z.object({
        totalRecipients: z.number().int().min(0).optional().default(0),
        messagesSent: z.number().int().min(0).optional().default(0),
        messagesDelivered: z.number().int().min(0).optional().default(0),
        messagesFailed: z.number().int().min(0).optional().default(0),
        responsesReceived: z.number().int().min(0).optional().default(0),
    }).optional(),
    lastRunAt: isoStringSchema.optional(),
    nextRunAt: isoStringSchema.optional(),
    error: z.string().optional(),
});

export const campaignSearchSchema = z.object({
    status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'failed']).optional(),
    createdBy: z.string().optional(),
    targetCrop: z.string().optional(),
    targetRegion: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
    sortBy: z.enum(['createdAt', 'updatedAt', 'nextRunAt', 'name']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const campaignOutreachStatsSchema = z.object({
    campaignId: z.string(),
    period: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional().default('week'),
    stats: z.array(z.object({
        date: isoStringSchema,
        sent: z.number().int().min(0),
        delivered: z.number().int().min(0),
        failed: z.number().int().min(0),
        responses: z.number().int().min(0),
        channel: z.enum(['sms', 'whatsapp', 'voice', 'email', 'push']).optional(),
    })),
    totals: z.object({
        sent: z.number().int().min(0),
        delivered: z.number().int().min(0),
        failed: z.number().int().min(0),
        responses: z.number().int().min(0),
        deliveryRate: z.number().min(0).max(1),
        responseRate: z.number().min(0).max(1),
    }),
});

export const campaignRetrySchema = z.object({
    campaignId: z.string(),
    resetStats: z.boolean().optional().default(false),
});

export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignGoal = z.infer<typeof campaignGoalSchema>;
export type CampaignSearchParams = z.infer<typeof campaignSearchSchema>;
export type CampaignOutreachStats = z.infer<typeof campaignOutreachStatsSchema>;
export type CampaignRetryInput = z.infer<typeof campaignRetrySchema>;