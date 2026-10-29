import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import subscriptionRouter from '@/routes/billing/subscription';
import { paymentService } from '@/services/paymentService';
import { cancellationFeedbackService } from '@/services/cancellationFeedbackService';

jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: Request, _res: Response, next: NextFunction) => {
        req.user = { userId: 'user-1', email: 'user@example.com', role: 'farmer' };
        next();
    },
}));

jest.mock('@/services/usageService', () => ({
    usageService: { getUsageStatus: jest.fn() },
    FREE_TIER_LIMITS: {},
}));

jest.mock('@/services/paymentService', () => ({
    paymentService: {
        cancelSubscription: jest.fn(),
        switchSubscription: jest.fn(),
        getPricingPlans: jest.fn(),
        getOrCreateCustomer: jest.fn(),
        createPortalSession: jest.fn(),
        createSubscriptionSession: jest.fn(),
    },
}));

jest.mock('@/services/cancellationFeedbackService', () => ({
    CANCELLATION_REASONS: [
        'too_expensive',
        'not_using_enough',
        'missing_features',
        'switching_service',
        'poor_support',
        'seasonal_pause',
        'other',
    ],
    isCancellationReason: (value: unknown) =>
        ['too_expensive', 'not_using_enough', 'missing_features', 'switching_service', 'poor_support', 'seasonal_pause', 'other'].includes(String(value)),
    cancellationFeedbackService: { record: jest.fn() },
}));

jest.mock('@/services/prismaService', () => {
    const prisma = {
        subscription: { findUnique: jest.fn(), update: jest.fn() },
        subscriptionPlan: { findFirst: jest.fn() },
        subscriptionChangeEvent: { create: jest.fn() },
    };
    return { getPrisma: () => prisma, __mockPrisma: prisma };
});

type AsyncMock = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

const mockPrisma = (jest.requireMock('@/services/prismaService') as {
    __mockPrisma: {
        subscription: { findUnique: AsyncMock; update: AsyncMock };
        subscriptionPlan: { findFirst: AsyncMock };
        subscriptionChangeEvent: { create: AsyncMock };
    };
}).__mockPrisma;

const mockCancel = paymentService.cancelSubscription as jest.MockedFunction<typeof paymentService.cancelSubscription>;
const mockSwitch = paymentService.switchSubscription as jest.MockedFunction<typeof paymentService.switchSubscription>;
const mockRecord = cancellationFeedbackService.record as jest.MockedFunction<typeof cancellationFeedbackService.record>;

const app = express();
app.use(express.json());
app.use('/api/v1/billing', subscriptionRouter);

const activeSubscription = {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'plan-old',
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_stripe_1',
    plan: {
        id: 'plan-old',
        name: 'Pro',
        price: 1500,
        currency: 'KES',
        interval: 'month',
        stripePriceId: 'price_old',
        isActive: true,
    },
};

describe('POST /api/v1/billing/cancel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCancel.mockResolvedValue(true);
        mockRecord.mockResolvedValue(true);
        mockPrisma.subscription.findUnique.mockResolvedValue(activeSubscription);
        mockPrisma.subscription.update.mockResolvedValue({});
    });

    it('cancels at period end and records the supplied reason', async () => {
        const response = await request(app)
            .post('/api/v1/billing/cancel')
            .send({ reason: 'too_expensive', comment: '  price creep  ' })
            .expect(200);

        expect(response.body).toMatchObject({ success: true, feedbackRecorded: true });
        expect(mockCancel).toHaveBeenCalledWith('sub_stripe_1');
        expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            data: { cancelAtPeriodEnd: true },
        });
        expect(mockRecord).toHaveBeenCalledWith({
            subscriptionId: 'sub-1',
            userId: 'user-1',
            reason: 'too_expensive',
            comment: '  price creep  ',
        });
    });

    it('rejects an unknown reason before touching the payment gateway', async () => {
        const response = await request(app)
            .post('/api/v1/billing/cancel')
            .send({ reason: 'because_i_said_so' })
            .expect(400);

        expect(response.body.errorCode).toBe('INVALID_CANCELLATION_REASON');
        expect(mockCancel).not.toHaveBeenCalled();
        expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
        expect(mockRecord).not.toHaveBeenCalled();
    });

    it('reports a failed gateway cancellation without flipping cancelAtPeriodEnd', async () => {
        mockCancel.mockResolvedValue(false);

        const response = await request(app)
            .post('/api/v1/billing/cancel')
            .send({ reason: 'not_using_enough' })
            .expect(500);

        expect(response.body.success).toBe(false);
        expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
        expect(mockRecord).not.toHaveBeenCalled();
    });

    it('returns feedbackRecorded=false when storing the reason fails', async () => {
        mockRecord.mockResolvedValue(false);

        const response = await request(app)
            .post('/api/v1/billing/cancel')
            .send({ reason: 'poor_support' })
            .expect(200);

        expect(response.body).toMatchObject({ success: true, feedbackRecorded: false });
        expect(mockPrisma.subscription.update).toHaveBeenCalled();
    });
});

describe('POST /api/v1/billing/switch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSwitch.mockResolvedValue({ success: true });
        mockPrisma.subscription.findUnique.mockResolvedValue(activeSubscription);
        mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
            id: 'plan-new',
            name: 'Scale',
            price: 3500,
            stripePriceId: 'price_new',
        });
        mockPrisma.subscription.update.mockResolvedValue({});
        mockPrisma.subscriptionChangeEvent.create.mockResolvedValue({});
    });

    it('switches immediately, mirrors the plan by subscription id and records the change', async () => {
        const response = await request(app)
            .post('/api/v1/billing/switch')
            .send({ priceId: 'price_new' })
            .expect(200);

        expect(response.body.message).toContain('switched successfully');
        expect(mockSwitch).toHaveBeenCalledWith('sub_stripe_1', 'price_new', false);
        expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: { planId: 'plan-new', status: 'active' },
        });
        expect(mockPrisma.subscriptionChangeEvent.create).toHaveBeenCalledWith({
            data: {
                subscriptionId: 'sub-1',
                fromPlanId: 'plan-old',
                toPlanId: 'plan-new',
                fromPrice: 1500,
                toPrice: 3500,
            },
        });
    });

    it('schedules a next-cycle switch without touching local plan state', async () => {
        const response = await request(app)
            .post('/api/v1/billing/switch')
            .send({ priceId: 'price_new', billingCycle: 'next' })
            .expect(200);

        expect(response.body.message).toContain('scheduled');
        expect(mockSwitch).toHaveBeenCalledWith('sub_stripe_1', 'price_new', true);
        expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
        expect(mockPrisma.subscriptionChangeEvent.create).not.toHaveBeenCalled();
    });

    it('rejects a non-string priceId before calling the gateway', async () => {
        const response = await request(app)
            .post('/api/v1/billing/switch')
            .send({ priceId: { nested: 'price_new' } })
            .expect(400);

        expect(response.body.message).toBe('Price ID is required');
        expect(mockSwitch).not.toHaveBeenCalled();
    });

    it('refuses to switch to the plan already subscribed to', async () => {
        const response = await request(app)
            .post('/api/v1/billing/switch')
            .send({ priceId: 'price_old' })
            .expect(400);

        expect(response.body.message).toBe('Already on this plan');
        expect(mockSwitch).not.toHaveBeenCalled();
    });

    it('reports a gateway failure and leaves the local mirror untouched', async () => {
        mockSwitch.mockResolvedValue({
            success: false,
            errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            message: 'Stripe is not configured.',
        });

        const response = await request(app)
            .post('/api/v1/billing/switch')
            .send({ priceId: 'price_new' })
            .expect(200);

        expect(response.body).toMatchObject({
            success: false,
            errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            message: 'Stripe is not configured.',
        });
        expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('leaves the local mirror alone when the gateway plan is not in the catalog', async () => {
        mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);

        const response = await request(app)
            .post('/api/v1/billing/switch')
            .send({ priceId: 'price_unknown' })
            .expect(200);

        expect(response.body.message).toContain('switched successfully');
        expect(mockSwitch).toHaveBeenCalledWith('sub_stripe_1', 'price_unknown', false);
        expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
        expect(mockPrisma.subscriptionChangeEvent.create).not.toHaveBeenCalled();
    });
});
