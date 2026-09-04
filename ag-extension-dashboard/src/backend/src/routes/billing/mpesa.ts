import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validationMiddleware';
import { getPrisma } from '@/services/prismaService';
import { MpesaDarajaService, normalizeMsisdn } from '@/services/mpesaDarajaService';
import { transactionService } from '@/services/transactionService';
import { writeAuditLog } from '@/middleware/auditMiddleware';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * M-Pesa STK push (Lipa Na M-Pesa Online).
 *
 * Flow: POST /stk-push → Safaricom prompts the phone → user enters PIN →
 * Safaricom POSTs /callback/:secret → we activate the plan. While waiting the
 * client polls GET /status/:checkoutRequestId. Falls back to the manual
 * /transaction/submit flow when Daraja credentials are not configured.
 */

const stkSchema = z.object({
    body: z.object({
        planId: z.string().uuid(),
        phone: z.string().min(9).max(15),
    }),
});

router.get('/availability', async (_req: Request, res: Response) => {
    const svc = MpesaDarajaService.fromEnv();
    res.json({ success: true, data: { stkPushAvailable: Boolean(svc), manualSubmissionAvailable: true } });
});

router.post('/stk-push', authorize(['admin', 'extension_officer', 'farmer']), validate(stkSchema), async (req: AuthRequest, res: Response) => {
    const svc = MpesaDarajaService.fromEnv();
    if (!svc) {
        return res.status(503).json({
            success: false,
            errorCode: 'MPESA_NOT_CONFIGURED',
            error: 'Automatic M-Pesa payment is not enabled on this deployment. Pay via Paybill and submit the receipt under "Manual payment".',
        });
    }
    try {
        const { planId, phone } = req.body as { planId: string; phone: string };
        const msisdn = normalizeMsisdn(phone);
        if (!msisdn) return res.status(400).json({ success: false, error: 'Enter a valid Kenyan mobile number (07XX… or 2547XX…)' });

        const prisma = getPrisma();
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

        const amountKes = svc.toKes(Number(plan.price), plan.currency);
        if (amountKes === null) {
            return res.status(400).json({ success: false, error: `Plan is priced in ${plan.currency}; set MPESA_KES_PER_USD to enable KES conversion.` });
        }

        // Provisional submission keyed by a placeholder until Daraja returns the CheckoutRequestID.
        const provisionalRef = `STK-PENDING-${crypto.randomUUID()}`;
        const submission = await prisma.transactionSubmission.create({
            data: {
                userId: req.user!.userId,
                planId,
                method: 'mpesa_stk',
                transactionId: provisionalRef,
                amount: amountKes,
                currency: 'KES',
                status: 'awaiting_payment',
            },
        });

        let push;
        try {
            push = await svc.stkPush({
                msisdn,
                amountKes,
                accountReference: `GPX${submission.id.slice(0, 8).toUpperCase()}`,
                description: plan.name.slice(0, 13),
            });
        } catch (err) {
            await prisma.transactionSubmission.update({ where: { id: submission.id }, data: { status: 'rejected', rejectionReason: `STK push failed: ${(err as Error).message}` } });
            throw err;
        }

        await prisma.transactionSubmission.update({ where: { id: submission.id }, data: { transactionId: push.checkoutRequestId } });

        res.json({
            success: true,
            data: {
                submissionId: submission.id,
                checkoutRequestId: push.checkoutRequestId,
                amountKes,
                customerMessage: push.customerMessage,
                pollUrl: `/api/v1/billing/mpesa/status/${push.checkoutRequestId}`,
            },
        });
    } catch (error) {
        logger.error('M-Pesa STK push failed:', error);
        safeError(res, 502, `M-Pesa request failed: ${(error as Error).message}`);
    }
});

router.get('/status/:checkoutRequestId', authorize(['admin', 'extension_officer', 'farmer']), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = getPrisma();
        const sub = await prisma.transactionSubmission.findFirst({
            where: { transactionId: req.params.checkoutRequestId, method: 'mpesa_stk' },
        });
        // After success the transactionId becomes the receipt; find by id passed as query fallback.
        if (!sub) {
            const byId = await prisma.transactionSubmission.findFirst({ where: { id: String(req.query.submissionId || ''), userId: req.user!.userId } }).catch(() => null);
            if (!byId) return res.status(404).json({ success: false, error: 'Unknown checkout request' });
            return res.json({ success: true, data: { status: byId.status, receipt: byId.status === 'verified' ? byId.transactionId : null, reason: byId.rejectionReason } });
        }
        if (sub.userId !== req.user!.userId && req.user!.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
        res.json({ success: true, data: { status: sub.status, receipt: sub.status === 'verified' ? sub.transactionId : null, reason: sub.rejectionReason } });
    } catch (error) {
        safeError(res, 500, 'Status lookup failed');
    }
});

/**
 * Daraja callback. Public (Safaricom calls it) but guarded by the secret path
 * segment. Always 200 so Safaricom does not retry forever; failures are logged.
 */
router.post('/callback/:secret', async (req: Request, res: Response) => {
    const expected = process.env.MPESA_CALLBACK_SECRET;
    const given = req.params.secret;
    const ok = expected && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!ok) {
        logger.warn(`M-Pesa callback with invalid secret from ${req.ip}`);
        return res.status(404).end();
    }

    const parsed = MpesaDarajaService.parseCallback(req.body);
    if (!parsed) {
        logger.warn('M-Pesa callback with unrecognised body');
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    try {
        const prisma = getPrisma();
        const sub = await prisma.transactionSubmission.findFirst({ where: { transactionId: parsed.checkoutRequestId, method: 'mpesa_stk' } });
        if (!sub) {
            logger.warn(`M-Pesa callback for unknown CheckoutRequestID ${parsed.checkoutRequestId}`);
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        if (sub.status !== 'awaiting_payment') {
            return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
        }

        if (parsed.resultCode === 0 && parsed.receipt) {
            const result = await transactionService.activateSubmission(sub.id, {
                verifiedBy: null,
                source: 'mpesa_callback',
                providerReceipt: parsed.receipt,
                providerAmount: parsed.amount,
            });
            await writeAuditLog({
                actorId: null, actorRole: 'system', action: result.success ? 'billing.mpesa_stk_verified' : 'billing.mpesa_stk_amount_mismatch',
                method: 'POST', path: '/api/v1/billing/mpesa/callback', resourceType: 'transaction_submissions', resourceId: sub.id,
                statusCode: 200, ipAddress: req.ip ?? null, requestBody: { receipt: parsed.receipt, amount: parsed.amount, phone: parsed.phone, resultDesc: parsed.resultDesc },
            });
            if (!result.success) {
                await prisma.transactionSubmission.update({ where: { id: sub.id }, data: { status: 'pending', rejectionReason: `Auto-verify blocked: ${result.message}` } });
            }
        } else {
            await prisma.transactionSubmission.update({
                where: { id: sub.id },
                data: { status: 'rejected', rejectionReason: `M-Pesa ${parsed.resultCode}: ${parsed.resultDesc}`.slice(0, 500) },
            });
        }
    } catch (error) {
        logger.error('M-Pesa callback processing failed:', error);
    }
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default router;
