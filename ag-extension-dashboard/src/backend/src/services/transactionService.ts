import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';

export type TransactionMethod = 'mpesa' | 'airtel' | 'bank';
export type TransactionStatus = 'pending' | 'verified' | 'rejected';

class TransactionService {
    /**
     * Submit a manual transaction (M-Pesa, Airtel Money, Bank Transfer).
     * Creates a pending record for admin verification.
     */
    async submitTransaction(params: {
        userId: string;
        planId: string;
        method: TransactionMethod;
        transactionId: string;
        amount: number;
        currency?: string;
    }): Promise<{ success: boolean; message: string; submissionId?: string }> {
        const prisma = getPrisma();

        // Validate plan exists
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } });
        if (!plan) {
            return { success: false, message: 'Invalid plan selected.' };
        }

        // The submitted amount must cover the plan price. Client-supplied amounts are
        // otherwise trusted verbatim by the admin approval step.
        const planPrice = Number(plan.price);
        const submittedAmount = Number(params.amount);
        if (!Number.isFinite(submittedAmount) || submittedAmount <= 0) {
            return { success: false, message: 'A valid payment amount is required.' };
        }
        if (Number.isFinite(planPrice) && submittedAmount + 0.005 < planPrice) {
            return {
                success: false,
                message: `Submitted amount (${submittedAmount.toFixed(2)}) is below the ${plan.name} plan price (${planPrice.toFixed(2)} ${plan.currency}).`,
            };
        }
        if (params.currency && plan.currency && params.currency.toUpperCase() !== String(plan.currency).toUpperCase()) {
            return { success: false, message: `Payment currency must be ${plan.currency}.` };
        }

        // Basic receipt-format sanity per provider (prevents obvious junk reaching admins).
        const receipt = params.transactionId.trim();
        const formatOk =
            params.method === 'mpesa' ? /^[A-Z0-9]{10}$/i.test(receipt)
            : params.method === 'airtel' ? /^[A-Z0-9.\-]{8,32}$/i.test(receipt)
            : /^[A-Z0-9\-\/ ]{6,64}$/i.test(receipt);
        if (!formatOk) {
            return { success: false, message: `"${receipt}" does not look like a valid ${params.method} reference.` };
        }

        // Check for duplicate transaction ID
        const existing = await prisma.transactionSubmission.findUnique({
            where: { transactionId: params.transactionId },
        });
        if (existing) {
            return { success: false, message: 'This transaction ID has already been submitted.' };
        }

        // Check if user already has a pending submission
        const pendingSubmission = await prisma.transactionSubmission.findFirst({
            where: { userId: params.userId, status: 'pending' },
        });
        if (pendingSubmission) {
            return { success: false, message: 'You already have a pending transaction awaiting verification.' };
        }

        const submission = await prisma.transactionSubmission.create({
            data: {
                userId: params.userId,
                planId: params.planId,
                method: params.method,
                transactionId: params.transactionId,
                amount: params.amount,
                currency: params.currency || plan.currency,
            },
        });

        logger.info(`Transaction submitted: ${params.method} ID ${params.transactionId} by user ${params.userId}`);
        return { success: true, message: 'Transaction submitted for verification. You will be notified once an admin approves it.', submissionId: submission.id };
    }

    /**
     * Admin: Verify (approve) a pending transaction and activate the user's subscription.
     */
    async verifyTransaction(submissionId: string, adminUserId: string): Promise<{ success: boolean; message: string }> {
        return this.activateSubmission(submissionId, { verifiedBy: adminUserId, source: 'admin' });
    }

    /**
     * Mark a submission verified and activate the plan. Shared by the admin
     * verification path and automated provider callbacks (M-Pesa STK). For
     * automated verification `verifiedBy` is null and `providerReceipt` replaces the
     * user-supplied reference so the payment row carries the authoritative receipt.
     */
    async activateSubmission(
        submissionId: string,
        opts: { verifiedBy: string | null; source: 'admin' | 'mpesa_callback'; providerReceipt?: string; providerAmount?: number }
    ): Promise<{ success: boolean; message: string }> {
        const prisma = getPrisma();
        const submission = await prisma.transactionSubmission.findUnique({
            where: { id: submissionId },
            include: { plan: true, user: true },
        });

        if (!submission) {
            return { success: false, message: 'Transaction submission not found.' };
        }
        if (submission.status !== 'pending' && submission.status !== 'awaiting_payment') {
            return { success: false, message: `Transaction is already ${submission.status}.` };
        }
        if (opts.source === 'mpesa_callback' && typeof opts.providerAmount === 'number' && opts.providerAmount + 0.005 < Number(submission.amount)) {
            return { success: false, message: `Provider reported ${opts.providerAmount}, below expected ${Number(submission.amount)}.` };
        }

        const now = new Date();
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const transactionRef = opts.providerReceipt || submission.transactionId;

        await prisma.$transaction([
            prisma.transactionSubmission.update({
                where: { id: submissionId },
                data: {
                    status: 'verified',
                    verifiedAt: now,
                    verifiedBy: opts.verifiedBy,
                    ...(opts.providerReceipt ? { transactionId: opts.providerReceipt } : {}),
                },
            }),
            prisma.subscription.upsert({
                where: { userId: submission.userId },
                update: {
                    planId: submission.planId,
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                },
                create: {
                    userId: submission.userId,
                    planId: submission.planId,
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                },
            }),
        ]);

        // Create auditable payment record
        const subscription = await prisma.subscription.findUnique({ where: { userId: submission.userId } });
        if (subscription) {
            await prisma.payment.create({
                data: {
                    subscriptionId: subscription.id,
                    amount: submission.amount,
                    currency: submission.currency,
                    status: 'completed',
                    paymentMethod: submission.method,
                    transactionId: transactionRef,
                    paidAt: now,
                },
            });
        }

        logger.info(`Transaction ${transactionRef} verified via ${opts.source}${opts.verifiedBy ? ` by ${opts.verifiedBy}` : ''}. User ${submission.userId} upgraded to ${submission.plan.name}.`);
        return { success: true, message: `Transaction verified. User upgraded to ${submission.plan.name}.` };
    }

    /**
     * Admin: Reject a pending transaction.
     */
    async rejectTransaction(submissionId: string, adminUserId: string, reason: string): Promise<{ success: boolean; message: string }> {
        const prisma = getPrisma();
        const submission = await prisma.transactionSubmission.findUnique({ where: { id: submissionId } });

        if (!submission) {
            return { success: false, message: 'Transaction submission not found.' };
        }
        if (submission.status !== 'pending') {
            return { success: false, message: `Transaction is already ${submission.status}.` };
        }

        await prisma.transactionSubmission.update({
            where: { id: submissionId },
            data: {
                status: 'rejected',
                rejectionReason: reason,
                verifiedAt: new Date(),
                verifiedBy: adminUserId,
            },
        });

        logger.info(`Transaction ${submission.transactionId} rejected by admin ${adminUserId}. Reason: ${reason}`);
        return { success: true, message: 'Transaction rejected.' };
    }

    /**
     * List transaction submissions with optional filters.
     */
    async listTransactions(filters?: { status?: TransactionStatus; userId?: string }) {
        const prisma = getPrisma();
        return prisma.transactionSubmission.findMany({
            where: {
                ...(filters?.status ? { status: filters.status } : {}),
                ...(filters?.userId ? { userId: filters.userId } : {}),
            },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
                plan: { select: { id: true, name: true, price: true, currency: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a user's own submission status.
     */
    async getUserSubmissions(userId: string) {
        const prisma = getPrisma();
        return prisma.transactionSubmission.findMany({
            where: { userId },
            include: { plan: { select: { id: true, name: true, price: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
}

export const transactionService = new TransactionService();
