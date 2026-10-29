const mockPrisma = {
    subscription: { count: jest.fn() },
    cancellationFeedback: { groupBy: jest.fn() },
};

jest.mock('../services/prismaService', () => ({
    getPrisma: () => mockPrisma,
}));

import { paymentAnalyticsService } from '../services/paymentAnalyticsService';

describe('Payment analytics: churn reasons', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('aggregates self-reported reasons and reports feedback coverage', async () => {
        mockPrisma.subscription.count.mockImplementation(async (args: { where: { status?: string } }) => {
            if (args.where.status === 'canceled') return 10;
            if (args.where.status === 'past_due') return 2;
            return 40; // active
        });
        mockPrisma.cancellationFeedback.groupBy.mockResolvedValue([
            { reason: 'too_expensive', _count: { _all: 4 } },
            { reason: 'missing_features', _count: { _all: 2 } },
        ]);

        const result = await paymentAnalyticsService.getChurnPrediction();

        expect(mockPrisma.cancellationFeedback.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ['reason'],
                where: { createdAt: { gte: expect.any(Date) } },
                _count: { _all: true },
            })
        );
        expect(result.churnReasons).toEqual([
            { reason: 'too_expensive', count: 4, percentage: (4 / 6) * 100 },
            { reason: 'missing_features', count: 2, percentage: (2 / 6) * 100 },
        ]);
        expect(result.churnReasonCoverage).toEqual({ recorded: 6, cancellationsLast30Days: 10 });
        // Predicted churn still comes from cancellation counts, not from feedback.
        expect(result.predictedChurnRate).toBe(25);
        expect(result.atRiskCustomers).toBe(2);
    });

    it('returns empty reasons with zero coverage when no feedback was recorded', async () => {
        mockPrisma.subscription.count.mockImplementation(async (args: { where: { status?: string } }) => {
            if (args.where.status === 'canceled') return 3;
            if (args.where.status === 'past_due') return 0;
            return 6;
        });
        mockPrisma.cancellationFeedback.groupBy.mockResolvedValue([]);

        const result = await paymentAnalyticsService.getChurnPrediction();

        expect(result.churnReasons).toEqual([]);
        expect(result.churnReasonCoverage).toEqual({ recorded: 0, cancellationsLast30Days: 3 });
    });
});
