/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;
function getPrisma() {
    if (!prisma) {
        prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    }
    return prisma;
}

export type UsageType = 'sms' | 'ai_chat' | 'report' | 'ai_vision';

export interface PlanLimits {
    smsLimit: number;
    aiChatLimit: number;
    reportLimit: number;
    aiVisionLimit: number;
}

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
            throw error;
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: any = {};
            if (type === 'sms') updateData.smsCount = { increment: count };
            if (type === 'ai_chat') updateData.aiChatCount = { increment: count };
            if (type === 'report') updateData.reportCount = { increment: count };
            if (type === 'ai_vision') updateData.aiVisionCount = { increment: count };

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
        try {
            const subscription = await getPrisma().subscription.findUnique({
                where: { userId },
                include: { usage: true },
            });

            if (!subscription || !subscription.usage) {
                logger.warn(`No subscription or usage record found for user ${userId}`);
                return false;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: any = {};
            if (type === 'sms') updateData.smsCount = { increment: 1 };
            if (type === 'ai_chat') updateData.aiChatCount = { increment: 1 };
            if (type === 'report') updateData.reportCount = { increment: 1 };
            if (type === 'ai_vision') updateData.aiVisionCount = { increment: 1 };

            await getPrisma().usage.update({
                where: { id: subscription.usage.id },
                data: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            });

            return true;
        } catch (error) {
            logger.error(`Failed to increment ${type} usage:`, error);
            return false;
        }
    }

    async checkLimit(userId: string, type: UsageType): Promise<{ allowed: boolean; current: number; limit: number }> {
        try {
            const data = await this.getUsage(userId);
            if (!data || !data.usage || !data.plan || !data.plan.features) {
                // If no plan/features (e.g. demo mode), default to allowed with generous limits
                return { allowed: true, current: 0, limit: 100 };
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const features = data.plan.features as any;

            let current = 0;
            let limit = 0;

            if (type === 'sms') {
                current = data.usage.smsCount;
                limit = features.smsLimit || 0;
            } else if (type === 'ai_chat') {
                current = data.usage.aiChatCount;
                limit = features.aiChatLimit || 0;
            } else if (type === 'report') {
                current = data.usage.reportCount;
                limit = features.reportLimit || 0;
            } else if (type === 'ai_vision') {
                current = (data.usage as any).aiVisionCount || 0;
                limit = features.aiVisionLimit || 0;
            }

            return {
                allowed: current < limit || limit === -1, // -1 for unlimited
                current,
                limit,
            };
        } catch (error) {
            logger.error(`Failed to check ${type} limit:`, error);
            return { allowed: true, current: 0, limit: 100 };
        }
    }

    async getUsageStatus(userId: string) {
        try {
            const data = await this.getUsage(userId);
            if (!data) return null;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const features = (data.plan.features as any) || {};

            return {
                plan: {
                    name: data.plan.name,
                    status: data.status,
                },
                usage: [
                    {
                        type: 'ai_chat',
                        current: data.usage?.aiChatCount || 0,
                        limit: features.aiChatLimit || 0,
                        label: 'AI ADVISOR CREDITS',
                    },
                    {
                        type: 'sms',
                        current: data.usage?.smsCount || 0,
                        limit: features.smsLimit || 0,
                        label: 'SMS BROADCASTS',
                    },
                    {
                        type: 'report',
                        current: data.usage?.reportCount || 0,
                        limit: features.reportLimit || 0,
                        label: 'ANALYTIC REPORTS',
                    }
                ],
                periodEnd: data.currentPeriodEnd,
            };
        } catch (error) {
            logger.error('Failed to get usage status:', error);
            throw error;
        }
    }

    async resetUsage(subscriptionId: string) {
        try {
            await getPrisma().usage.update({
                where: { subscriptionId },
                data: {
                    smsCount: 0,
                    aiChatCount: 0,
                    reportCount: 0,
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
