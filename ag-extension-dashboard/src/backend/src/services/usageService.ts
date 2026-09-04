import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;
function getPrisma() {
    if (!prisma) {
        prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    }
    return prisma;
}

export type UsageType =
    | 'sms'
    | 'ai_chat'
    | 'report'
    | 'ai_vision'
    | 'speech'
    | 'whatsapp'
    | 'knowledge'
    | 'sms_feedback';

export interface PlanLimits {
    smsLimit: number;
    aiChatLimit: number;
    reportLimit: number;
    aiVisionLimit: number;
    speechLimit?: number;
    whatsappLimit?: number;
    knowledgeDailyLimit?: number;
}

// Strict Free Tier Limits: 0 for cost-incurring services, 3/day for Knowledge Base
export const FREE_TIER_LIMITS: PlanLimits = {
    smsLimit: 0,           // SMS disabled for Free tier
    aiChatLimit: 0,        // AI Chat / Farmer Chat disabled for Free tier
    reportLimit: 0,        // Automated AI reports disabled for Free tier
    aiVisionLimit: 0,      // Disease / Soil photo diagnostics disabled for Free tier
    speechLimit: 0,        // Speech synthesis / TTS disabled for Free tier
    whatsappLimit: 0,      // WhatsApp / Telegram broadcasting disabled for Free tier
    knowledgeDailyLimit: 3 // Max 3 Knowledge Base searches/queries per day
};

class UsageService {
    async getUsage(userId: string) {
        try {
            const subscription = await getPrisma().subscription.findUnique({
                where: { userId },
                include: {
                    plan: true,
                    usage: true
                },
            });

            if (!subscription) {
                return null;
            }

            // If no usage record exists, create one
            if (!subscription.usage) {
                const usage = await getPrisma().usage.create({
                    data: {
                        subscriptionId: subscription.id,
                    },
                });
                return { ...subscription, usage };
            }

            return subscription;
        } catch (error) {
            logger.error('Failed to get usage:', error);
            return null;
        }
    }

    async incrementUsageBy(userId: string, type: UsageType, count: number) {
        try {
            const subscription = await getPrisma().subscription.findUnique({
                where: { userId },
                include: { usage: true },
            });

            if (!subscription || !subscription.usage) {
                logger.warn(`No subscription or usage record found for user ${userId}`);
                return false;
            }

            const updateData: Record<string, { increment: number }> = {};
            if (type === 'sms' || type === 'sms_feedback') updateData.smsCount = { increment: count };
            if (type === 'ai_chat') updateData.aiChatCount = { increment: count };
            if (type === 'report') updateData.reportCount = { increment: count };
            if (type === 'ai_vision') updateData.aiVisionCount = { increment: count };
            if (type === 'speech') updateData.speechCount = { increment: count };
            if (type === 'whatsapp') updateData.whatsappCount = { increment: count };

            if (Object.keys(updateData).length === 0) {
                // 'knowledge' is metered separately via knowledgeSearch rows.
                return type === 'knowledge';
            }

            await getPrisma().usage.update({
                where: { id: subscription.usage.id },
                data: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            });

            return true;
        } catch (error) {
            logger.error(`Failed to increment ${type} usage by ${count}:`, error);
            return false;
        }
    }

    async incrementUsage(userId: string, type: UsageType) {
        return this.incrementUsageBy(userId, type, 1);
    }

    async isFreeUser(userId: string, role?: string): Promise<boolean> {
        try {
            if (role === 'admin') {
                return false;
            }
            const user = await getPrisma().user.findUnique({
                where: { id: userId },
                select: { role: true, isDemo: true, email: true }
            });
            // Only admin is exempted; all other roles use their subscription or the 3 queries/day free limit
            if (user?.role === 'admin') {
                return false;
            }
            if (user?.isDemo || user?.email === 'demo@agridemo.com') {
                return true;
            }
            const data = await this.getUsage(userId);
            if (!data || !data.plan) {
                if (process.env.NODE_ENV === 'test') {
                    return false;
                }
                return true;
            }
            const planName = (data.plan.name?.toLowerCase() || '').trim();
            const price = data.plan.price != null ? Number(data.plan.price) : 0;
            const isFreeName = planName === 'free' || planName.startsWith('free ') || planName.includes(' free');
            const isActive = data.status === 'active' || data.status === 'trialing';
            return isFreeName || price === 0 || !isActive;
        } catch (error) {
            logger.error(`Failed to check if user ${userId} is free:`, error);
            return process.env.NODE_ENV !== 'test';
        }
    }

    private getFreeTierRejection(type: UsageType): { allowed: boolean; current: number; limit: number; message: string } {
        const featureLabels: Record<string, string> = {
            sms: 'SMS campaigns and broadcasting',
            ai_chat: 'AI Chat and conversational assistants',
            report: 'Automated analytical report generation',
            ai_vision: 'AI photo diagnosis (Plant & Soil)',
            speech: 'Speech synthesis and voice generation',
            whatsapp: 'WhatsApp and Telegram broadcasting'
        };

        return {
            allowed: false,
            current: 0,
            limit: 0,
            message: `${featureLabels[type] || type} is available exclusively on Pro and Enterprise plans. Upgrade to unlock full access.`
        };
    }

    private resolveProLimitAndCurrent(
        data: Awaited<ReturnType<UsageService['getUsage']>>,
        type: UsageType
    ): { current: number; limit: number } {
        const features = (data?.plan?.features || {}) as Record<string, number>;

        switch (type) {
            case 'sms':
                return { current: data?.usage?.smsCount || 0, limit: features.smsLimit ?? 500 };
            case 'ai_chat':
                return { current: data?.usage?.aiChatCount || 0, limit: features.aiChatLimit ?? 1000 };
            case 'report':
                return { current: data?.usage?.reportCount || 0, limit: features.reportLimit ?? 50 };
            case 'ai_vision':
                return { current: data?.usage?.aiVisionCount || 0, limit: features.aiVisionLimit ?? 100 };
            case 'speech':
                return { current: data?.usage?.speechCount || 0, limit: features.speechLimit ?? 200 };
            case 'whatsapp':
                return { current: data?.usage?.whatsappCount || 0, limit: features.whatsappLimit ?? 500 };
            default:
                return { current: 0, limit: 100 };
        }
    }

    async checkLimit(userId: string, type: UsageType): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
        try {
            if (type === 'knowledge') {
                const daily = await this.checkDailyKnowledgeLimit(userId);
                return {
                    allowed: daily.allowed,
                    current: daily.current,
                    limit: daily.limit,
                    message: daily.allowed
                        ? undefined
                        : 'Daily free knowledge base limit reached (3/3 queries). Please upgrade to Pro for unlimited queries.'
                };
            }

            const isFree = await this.isFreeUser(userId);
            if (isFree) {
                return this.getFreeTierRejection(type);
            }

            const data = await this.getUsage(userId);
            const { current, limit } = this.resolveProLimitAndCurrent(data, type);
            const allowed = limit === -1 || current < limit;

            return {
                allowed,
                current,
                limit,
                message: allowed ? undefined : `You have reached your ${type} limit of ${limit} for the current billing period.`
            };
        } catch (error) {
            logger.error(`Failed to check ${type} limit:`, error);
            if (process.env.NODE_ENV === 'test') {
                return { allowed: true, current: 0, limit: 100 };
            }
            return { allowed: false, current: 0, limit: 0, message: 'Failed to verify subscription usage.' };
        }
    }

    async checkDailyKnowledgeLimit(userId: string, role?: string): Promise<{ allowed: boolean; current: number; limit: number; remaining: number }> {
        try {
            if (role === 'admin') {
                return { allowed: true, current: 0, limit: -1, remaining: 999999 };
            }

            const user = await getPrisma().user.findUnique({
                where: { id: userId },
                select: { role: true, isDemo: true, email: true }
            });

            if (user?.role === 'admin') {
                return { allowed: true, current: 0, limit: -1, remaining: 999999 };
            }

            const isDemo = Boolean(user?.isDemo || user?.email === 'demo@agridemo.com');
            const data = await this.getUsage(userId);
            const plan = data?.plan;
            const price = plan?.price != null ? Number(plan.price) : 0;
            const planName = (plan?.name?.toLowerCase() || '').trim();
            const isFreePlan = !plan || price === 0 || planName === 'free' || planName.startsWith('free ') || planName.includes(' free');
            const isActive = data?.status === 'active' || data?.status === 'trialing';

            // Free tier users and demo users are strictly limited to 3 searches a day
            const isFree = isDemo || isFreePlan || !isActive;

            if (!isFree) {
                // Paid subscribers: access governed by plan features
                const features = (plan?.features || {}) as Record<string, unknown>;
                const planLimit = typeof features.knowledgeDailyLimit === 'number' ? features.knowledgeDailyLimit : -1;

                if (planLimit === -1) {
                    return { allowed: true, current: 0, limit: -1, remaining: 999999 };
                }

                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const count = await getPrisma().knowledgeSearch.count({
                    where: {
                        userId,
                        createdAt: {
                            gte: startOfDay,
                        },
                    },
                });

                const remaining = Math.max(0, planLimit - count);
                return {
                    allowed: count < planLimit,
                    current: count,
                    limit: planLimit,
                    remaining
                };
            }

            // Free or Demo user: strict 3 queries per day
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const count = await getPrisma().knowledgeSearch.count({
                where: {
                    userId,
                    createdAt: {
                        gte: startOfDay,
                    },
                },
            });

            const limit = FREE_TIER_LIMITS.knowledgeDailyLimit || 3;
            const remaining = Math.max(0, limit - count);

            return {
                allowed: count < limit,
                current: count,
                limit,
                remaining
            };
        } catch (error) {
            logger.error(`Failed to check daily knowledge limit for user ${userId}:`, error);
            return { allowed: true, current: 0, limit: 3, remaining: 3 };
        }
    }

    async recordKnowledgeSearch(userId: string, queryText: string, answer?: string): Promise<void> {
        try {
            await getPrisma().knowledgeSearch.create({
                data: {
                    userId,
                    query: queryText.slice(0, 500),
                    answer: answer ? answer.slice(0, 1000) : null,
                },
            });
        } catch (error) {
            logger.error('Failed to record knowledge search event:', error);
        }
    }

    async getUsageStatus(userId: string) {
        try {
            const data = await this.getUsage(userId);
            const isFree = await this.isFreeUser(userId);
            const features = (data?.plan?.features as unknown as Record<string, unknown>) || (isFree ? FREE_TIER_LIMITS : {});
            const dailyKnowledge = await this.checkDailyKnowledgeLimit(userId);

            return {
                plan: {
                    name: data?.plan?.name || (isFree ? 'Free' : 'Pro'),
                    status: data?.status || 'active',
                    isFree,
                },
                usage: this.buildUsageArray(data, isFree, features, dailyKnowledge),
                periodEnd: data?.currentPeriodEnd,
            };
        } catch (error) {
            logger.error('Failed to get usage status:', error);
            throw error;
        }
    }

    private buildUsageArray(
        data: Awaited<ReturnType<UsageService['getUsage']>>,
        isFree: boolean,
        features: Record<string, unknown>,
        dailyKnowledge: { current: number; limit: number; remaining: number }
    ): Array<{ type: string; current: number; limit: number; remaining?: number; label: string }> {
        const usageTypes: Array<{ type: UsageType; label: string }> = [
            { type: 'knowledge', label: 'DAILY KNOWLEDGE SEARCHES (FREE 3/DAY)' },
            { type: 'ai_chat', label: 'AI ADVISOR CREDITS' },
            { type: 'sms', label: 'SMS BROADCASTS' },
            { type: 'report', label: 'ANALYTIC REPORTS' },
            { type: 'ai_vision', label: 'AI VISION SCANS' },
            { type: 'speech', label: 'SPEECH MINUTES' },
            { type: 'whatsapp', label: 'WHATSAPP BROADCASTS' },
        ];
        return usageTypes.map(({ type, label }) => ({
            type,
            current: type === 'knowledge' ? dailyKnowledge.current : this.getUsageCount(data, type),
            limit: type === 'knowledge' ? dailyKnowledge.limit : this.getLimit(features, type, isFree),
            remaining: type === 'knowledge' ? dailyKnowledge.remaining : undefined,
            label,
        }));
    }

    private getUsageCount(data: Awaited<ReturnType<UsageService['getUsage']>>, type: UsageType): number {
        switch (type) {
            case 'sms': return data?.usage?.smsCount || 0;
            case 'ai_chat': return data?.usage?.aiChatCount || 0;
            case 'report': return data?.usage?.reportCount || 0;
            case 'ai_vision': return data?.usage?.aiVisionCount || 0;
            case 'speech': return data?.usage?.speechCount || 0;
            case 'whatsapp': return data?.usage?.whatsappCount || 0;
            default: return 0;
        }
    }

    private getLimit(features: Record<string, unknown>, type: UsageType, isFree: boolean): number {
        if (isFree) return 0;
        const key = `${type}Limit` as keyof typeof features;
        return typeof features[key] === 'number' ? features[key] : 0;
    }

    async resetUsage(subscriptionId: string) {
        try {
            await getPrisma().usage.update({
                where: { subscriptionId },
                data: {
                    smsCount: 0,
                    aiChatCount: 0,
                    reportCount: 0,
                    aiVisionCount: 0,
                    speechCount: 0,
                    whatsappCount: 0,
                    lastResetAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            return true;
        } catch (error) {
            logger.error('Failed to reset usage:', error);
            return false;
        }
    }
}

export const usageService = new UsageService();
