import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';

export interface RevenueMetrics {
    mrr: number; // Monthly Recurring Revenue
    arr: number; // Annual Recurring Revenue
    totalRevenue: number;
    newRevenue: number;
    expansionRevenue: number;
    contractionRevenue: number;
    churnedRevenue: number;
    netRevenueChange: number;
}

export interface CustomerMetrics {
    totalCustomers: number;
    activeCustomers: number;
    churnedCustomers: number;
    newCustomers: number;
    customerLifetimeValue: number;
    churnRate: number;
    retentionRate: number;
}

export interface SubscriptionMetrics {
    totalSubscriptions: number;
    activeSubscriptions: number;
    canceledSubscriptions: number;
    trialSubscriptions: number;
    paidSubscriptions: number;
    averageRevenuePerUser: number;
}

export interface PaymentMethodAnalytics {
    creditCard: number;
    paypal: number;
    other: number;
    creditCardPercentage: number;
    paypalPercentage: number;
}

export interface ChurnPrediction {
    predictedChurnRate: number;
    atRiskCustomers: number;
    churnReasons: Array<{
        reason: string;
        count: number;
        percentage: number;
    }>;
}

export interface CohortAnalysis {
    cohorts: Array<{
        period: string;
        customers: number;
        retained: number;
        churned: number;
        retentionRate: number;
        revenue: number;
    }>;
}

class PaymentAnalyticsService {
    private prisma = getPrisma();

    /**
     * Calculate Monthly Recurring Revenue (MRR)
     */
    async getMRR(): Promise<number> {
        try {
            const activeSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    status: 'active',
                    cancelAtPeriodEnd: false
                },
                include: {
                    plan: true
                }
            });

            return activeSubscriptions.reduce((total, sub) => {
                return total + Number(sub.plan.price);
            }, 0);
        } catch (error) {
            logger.error('Failed to calculate MRR:', error);
            return 0;
        }
    }

    /**
     * Calculate Annual Recurring Revenue (ARR)
     */
    async getARR(): Promise<number> {
        const mrr = await this.getMRR();
        return mrr * 12;
    }

    /**
     * Get comprehensive revenue metrics
     */
    async getRevenueMetrics(timeframe: 'month' | 'quarter' | 'year' = 'month'): Promise<RevenueMetrics> {
        try {
            const now = new Date();
            const startDate = new Date(now);
            const previousPeriodStart = new Date(now);

            // Calculate date ranges
            switch (timeframe) {
                case 'month':
                    startDate.setMonth(now.getMonth() - 1);
                    previousPeriodStart.setMonth(now.getMonth() - 2);
                    break;
                case 'quarter':
                    startDate.setMonth(now.getMonth() - 3);
                    previousPeriodStart.setMonth(now.getMonth() - 6);
                    break;
                case 'year':
                    startDate.setFullYear(now.getFullYear() - 1);
                    previousPeriodStart.setFullYear(now.getFullYear() - 2);
                    break;
            }

            // Current period revenue
            const currentRevenue = await this.prisma.payment.aggregate({
                where: {
                    paidAt: {
                        gte: startDate,
                        lte: now
                    },
                    status: 'completed'
                },
                _sum: {
                    amount: true
                }
            });

            // Previous period revenue for comparison
            const previousRevenue = await this.prisma.payment.aggregate({
                where: {
                    paidAt: {
                        gte: previousPeriodStart,
                        lt: startDate
                    },
                    status: 'completed'
                },
                _sum: {
                    amount: true
                }
            });

            const mrr = await this.getMRR();
            const arr = mrr * 12;
            const totalRevenue = Number(currentRevenue._sum.amount || 0) / 100; // Convert cents to dollars
            const previousTotalRevenue = Number(previousRevenue._sum.amount || 0) / 100;

            // Calculate revenue changes (simplified - would need more complex logic for expansion/contraction)
            const newRevenue = totalRevenue;
            const netRevenueChange = totalRevenue - previousTotalRevenue;

            return {
                mrr,
                arr,
                totalRevenue,
                newRevenue,
                expansionRevenue: 0, // Would need subscription change tracking
                contractionRevenue: 0, // Would need subscription change tracking
                churnedRevenue: Math.max(0, previousTotalRevenue - totalRevenue),
                netRevenueChange
            };
        } catch (error) {
            logger.error('Failed to get revenue metrics:', error);
            return {
                mrr: 0,
                arr: 0,
                totalRevenue: 0,
                newRevenue: 0,
                expansionRevenue: 0,
                contractionRevenue: 0,
                churnedRevenue: 0,
                netRevenueChange: 0
            };
        }
    }

    /**
     * Get customer metrics
     */
    async getCustomerMetrics(): Promise<CustomerMetrics> {
        try {
            const now = new Date();
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1);

            // Total customers with subscriptions
            const totalCustomers = await this.prisma.subscription.count();

            // Active customers
            const activeCustomers = await this.prisma.subscription.count({
                where: {
                    status: 'active'
                }
            });

            // New customers this month
            const newCustomers = await this.prisma.subscription.count({
                where: {
                    createdAt: {
                        gte: lastMonth
                    }
                }
            });

            // Churned customers (canceled subscriptions)
            const churnedCustomers = await this.prisma.subscription.count({
                where: {
                    status: 'canceled',
                    updatedAt: {
                        gte: lastMonth
                    }
                }
            });

            // Calculate rates
            const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
            const retentionRate = 100 - churnRate;

            // Calculate LTV (simplified - average revenue per customer)
            const totalRevenue = await this.prisma.payment.aggregate({
                where: {
                    status: 'completed'
                },
                _sum: {
                    amount: true
                }
            });

            const customerLifetimeValue = totalCustomers > 0
                ? (Number(totalRevenue._sum.amount || 0) / 100) / totalCustomers
                : 0;

            return {
                totalCustomers,
                activeCustomers,
                churnedCustomers,
                newCustomers,
                customerLifetimeValue,
                churnRate,
                retentionRate
            };
        } catch (error) {
            logger.error('Failed to get customer metrics:', error);
            return {
                totalCustomers: 0,
                activeCustomers: 0,
                churnedCustomers: 0,
                newCustomers: 0,
                customerLifetimeValue: 0,
                churnRate: 0,
                retentionRate: 0
            };
        }
    }

    /**
     * Get subscription metrics
     */
    async getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
        try {
            const totalSubscriptions = await this.prisma.subscription.count();

            const activeSubscriptions = await this.prisma.subscription.count({
                where: { status: 'active' }
            });

            const canceledSubscriptions = await this.prisma.subscription.count({
                where: { status: 'canceled' }
            });

            const trialSubscriptions = await this.prisma.subscription.count({
                where: { status: 'trialing' }
            });

            const paidSubscriptions = activeSubscriptions - trialSubscriptions;

            // Calculate ARPU
            const totalRevenue = await this.prisma.payment.aggregate({
                where: {
                    status: 'completed'
                },
                _sum: {
                    amount: true
                }
            });

            const averageRevenuePerUser = totalSubscriptions > 0
                ? (Number(totalRevenue._sum.amount || 0) / 100) / totalSubscriptions
                : 0;

            return {
                totalSubscriptions,
                activeSubscriptions,
                canceledSubscriptions,
                trialSubscriptions,
                paidSubscriptions,
                averageRevenuePerUser
            };
        } catch (error) {
            logger.error('Failed to get subscription metrics:', error);
            return {
                totalSubscriptions: 0,
                activeSubscriptions: 0,
                canceledSubscriptions: 0,
                trialSubscriptions: 0,
                paidSubscriptions: 0,
                averageRevenuePerUser: 0
            };
        }
    }

    /**
     * Get payment method analytics
     */
    async getPaymentMethodAnalytics(): Promise<PaymentMethodAnalytics> {
        try {
            const creditCardCount = await this.prisma.payment.count({
                where: {
                    paymentMethod: 'card'
                }
            });

            const paypalCount = await this.prisma.payment.count({
                where: {
                    paymentMethod: 'paypal'
                }
            });

            const totalPayments = creditCardCount + paypalCount;
            const otherCount = await this.prisma.payment.count() - totalPayments;

            const creditCardPercentage = totalPayments > 0 ? (creditCardCount / totalPayments) * 100 : 0;
            const paypalPercentage = totalPayments > 0 ? (paypalCount / totalPayments) * 100 : 0;

            return {
                creditCard: creditCardCount,
                paypal: paypalCount,
                other: otherCount,
                creditCardPercentage,
                paypalPercentage
            };
        } catch (error) {
            logger.error('Failed to get payment method analytics:', error);
            return {
                creditCard: 0,
                paypal: 0,
                other: 0,
                creditCardPercentage: 0,
                paypalPercentage: 0
            };
        }
    }

    /**
     * Get churn prediction analytics
     */
    async getChurnPrediction(): Promise<ChurnPrediction> {
        try {
            // Simplified churn prediction based on cancellation patterns
            const recentCancellations = await this.prisma.subscription.count({
                where: {
                    status: 'canceled',
                    updatedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                }
            });

            const totalActive = await this.prisma.subscription.count({
                where: { status: 'active' }
            });

            // Predict churn rate based on recent trends
            const predictedChurnRate = totalActive > 0 ? (recentCancellations / totalActive) * 100 : 0;

            // Identify at-risk customers (simplified - customers with failed payments)
            const atRiskCustomers = await this.prisma.subscription.count({
                where: {
                    status: 'past_due'
                }
            });

            // Churn reasons — requires actual cancellation feedback data
            const churnReasons: { reason: string; count: number; percentage: number }[] = [];

            return {
                predictedChurnRate,
                atRiskCustomers,
                churnReasons
            };
        } catch (error) {
            logger.error('Failed to get churn prediction:', error);
            return {
                predictedChurnRate: 0,
                atRiskCustomers: 0,
                churnReasons: []
            };
        }
    }

    /**
     * Get cohort analysis
     */
    async getCohortAnalysis(): Promise<CohortAnalysis> {
        try {
            const cohorts = [];
            const now = new Date();

            // Generate cohorts for last 6 months
            for (let i = 5; i >= 0; i--) {
                const cohortDate = new Date(now);
                cohortDate.setMonth(now.getMonth() - i);

                const startOfMonth = new Date(cohortDate.getFullYear(), cohortDate.getMonth(), 1);
                const endOfMonth = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 0);

                // Customers acquired in this month
                const customers = await this.prisma.subscription.count({
                    where: {
                        createdAt: {
                            gte: startOfMonth,
                            lte: endOfMonth
                        }
                    }
                });

                // Customers still active from this cohort
                const retained = await this.prisma.subscription.count({
                    where: {
                        createdAt: {
                            gte: startOfMonth,
                            lte: endOfMonth
                        },
                        status: 'active'
                    }
                });

                const churned = customers - retained;
                const retentionRate = customers > 0 ? (retained / customers) * 100 : 0;

                // Revenue from this cohort
                const revenueResult = await this.prisma.payment.aggregate({
                    where: {
                        subscription: {
                            createdAt: {
                                gte: startOfMonth,
                                lte: endOfMonth
                            }
                        },
                        status: 'completed'
                    },
                    _sum: {
                        amount: true
                    }
                });

                const revenue = Number(revenueResult._sum.amount || 0) / 100;

                cohorts.push({
                    period: startOfMonth.toISOString().substring(0, 7), // YYYY-MM format
                    customers,
                    retained,
                    churned,
                    retentionRate,
                    revenue
                });
            }

            return { cohorts };
        } catch (error) {
            logger.error('Failed to get cohort analysis:', error);
            return { cohorts: [] };
        }
    }

    /**
     * Get comprehensive analytics dashboard data
     */
    async getAnalyticsDashboard(): Promise<{
        revenue: RevenueMetrics;
        customers: CustomerMetrics;
        subscriptions: SubscriptionMetrics;
        paymentMethods: PaymentMethodAnalytics;
        churnPrediction: ChurnPrediction;
        cohorts: CohortAnalysis;
    }> {
        const [revenue, customers, subscriptions, paymentMethods, churnPrediction, cohorts] = await Promise.all([
            this.getRevenueMetrics(),
            this.getCustomerMetrics(),
            this.getSubscriptionMetrics(),
            this.getPaymentMethodAnalytics(),
            this.getChurnPrediction(),
            this.getCohortAnalysis()
        ]);

        return {
            revenue,
            customers,
            subscriptions,
            paymentMethods,
            churnPrediction,
            cohorts
        };
    }
}

export const paymentAnalyticsService = new PaymentAnalyticsService();