import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

class VoucherService {
    /**
     * Generate a batch of vouchers for a specific plan (Admin only).
     */
    async generateVouchers(planId: string, count: number, expiresInDays?: number): Promise<{ codes: string[] }> {
        const prisma = getPrisma();
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) throw new Error('Plan not found');

        const codes: string[] = [];
        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        for (let i = 0; i < count; i++) {
            const code = `AGV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            await prisma.voucher.create({
                data: {
                    code,
                    planId,
                    ...(expiresAt ? { expiresAt } : {}),
                },
            });
            codes.push(code);
        }

        logger.info(`Generated ${count} vouchers for plan "${plan.name}"`);
        return { codes };
    }

    /**
     * Redeem a voucher code: validates, marks as redeemed, and activates the subscription.
     */
    async redeemVoucher(userId: string, code: string): Promise<{
        success: boolean;
        message: string;
        planName?: string;
    }> {
        const prisma = getPrisma();
        const voucher = await prisma.voucher.findUnique({
            where: { code: code.trim().toUpperCase() },
            include: { plan: true },
        });

        if (!voucher) {
            return { success: false, message: 'Invalid voucher code.' };
        }
        if (voucher.isRedeemed) {
            return { success: false, message: 'This voucher has already been redeemed.' };
        }
        if (voucher.expiresAt && new Date() > voucher.expiresAt) {
            return { success: false, message: 'This voucher has expired.' };
        }

        // Atomically redeem the voucher and activate the subscription
        const now = new Date();
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await prisma.$transaction([
            prisma.voucher.update({
                where: { id: voucher.id },
                data: {
                    isRedeemed: true,
                    redeemedBy: userId,
                    redeemedAt: now,
                },
            }),
            prisma.subscription.upsert({
                where: { userId },
                update: {
                    planId: voucher.planId,
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                },
                create: {
                    userId,
                    planId: voucher.planId,
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                },
            }),
        ]);

        // Create an auditable payment record
        const subscription = await prisma.subscription.findUnique({ where: { userId } });
        if (subscription) {
            await prisma.payment.create({
                data: {
                    subscriptionId: subscription.id,
                    amount: voucher.plan.price,
                    currency: voucher.plan.currency,
                    status: 'completed',
                    paymentMethod: 'voucher',
                    transactionId: `VOUCHER-${voucher.code}`,
                    paidAt: now,
                },
            });
        }

        logger.info(`Voucher ${voucher.code} redeemed by user ${userId} for plan "${voucher.plan.name}"`);
        return { success: true, message: `Successfully activated ${voucher.plan.name} plan!`, planName: voucher.plan.name };
    }

    /**
     * List all vouchers (Admin only).
     */
    async listVouchers(filters?: { planId?: string; isRedeemed?: boolean }) {
        const prisma = getPrisma();
        return prisma.voucher.findMany({
            where: {
                ...(filters?.planId ? { planId: filters.planId } : {}),
                ...(filters?.isRedeemed !== undefined ? { isRedeemed: filters.isRedeemed } : {}),
            },
            include: { plan: true, redeemedByUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
}

export const voucherService = new VoucherService();
