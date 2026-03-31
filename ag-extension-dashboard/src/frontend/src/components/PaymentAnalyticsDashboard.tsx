import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    Users,
    DollarSign,
    CreditCard,
    BarChart3,
    PieChart,
    Activity,
    AlertTriangle,
    Target,
    Calendar,
    ArrowUp,
    ArrowDown,
    Minus
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import {
    getAnalyticsDashboard,
    getRevenueAnalytics,
    getCustomerAnalytics,
    getSubscriptionAnalytics,
    getPaymentMethodAnalytics,
    getChurnAnalytics,
    getCohortAnalytics
} from '@/api/billingService';

interface RevenueMetrics {
    mrr: number;
    arr: number;
    totalRevenue: number;
    newRevenue: number;
    expansionRevenue: number;
    contractionRevenue: number;
    churnedRevenue: number;
    netRevenueChange: number;
}

interface CustomerMetrics {
    totalCustomers: number;
    activeCustomers: number;
    churnedCustomers: number;
    newCustomers: number;
    customerLifetimeValue: number;
    churnRate: number;
    retentionRate: number;
}

interface SubscriptionMetrics {
    totalSubscriptions: number;
    activeSubscriptions: number;
    canceledSubscriptions: number;
    trialSubscriptions: number;
    paidSubscriptions: number;
    averageRevenuePerUser: number;
}

interface PaymentMethodAnalytics {
    creditCard: number;
    paypal: number;
    other: number;
    creditCardPercentage: number;
    paypalPercentage: number;
}

interface ChurnPrediction {
    predictedChurnRate: number;
    atRiskCustomers: number;
    churnReasons: Array<{
        reason: string;
        count: number;
        percentage: number;
    }>;
}

interface CohortAnalysis {
    cohorts: Array<{
        period: string;
        customers: number;
        retained: number;
        churned: number;
        retentionRate: number;
        revenue: number;
    }>;
}

interface AnalyticsData {
    revenue: RevenueMetrics;
    customers: CustomerMetrics;
    subscriptions: SubscriptionMetrics;
    paymentMethods: PaymentMethodAnalytics;
    churnPrediction: ChurnPrediction;
    cohorts: CohortAnalysis;
}

export const PaymentAnalyticsDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'month' | 'quarter' | 'year'>('month');
    const { user } = useAppStore();

    useEffect(() => {
        fetchAnalytics();
    }, [timeframe]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const [dashboardRes, revenueRes, customerRes, subscriptionRes, paymentMethodRes, churnRes, cohortRes] = await Promise.all([
                getAnalyticsDashboard(),
                getRevenueAnalytics(timeframe),
                getCustomerAnalytics().catch(() => null),
                getSubscriptionAnalytics().catch(() => null),
                getPaymentMethodAnalytics().catch(() => null),
                getChurnAnalytics().catch(() => null),
                getCohortAnalytics().catch(() => null),
            ]);

            if (dashboardRes.success && revenueRes.success) {
                setAnalytics({
                    ...dashboardRes.data,
                    revenue: revenueRes.data,
                    ...(customerRes?.success && { customers: customerRes.data }),
                    ...(subscriptionRes?.success && { subscriptions: subscriptionRes.data }),
                    ...(paymentMethodRes?.success && { paymentMethods: paymentMethodRes.data }),
                    ...(churnRes?.success && { churnPrediction: churnRes.data }),
                    ...(cohortRes?.success && { cohorts: cohortRes.data }),
                });
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatPercentage = (value: number) => {
        return `${value.toFixed(1)}%`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]" role="status">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-primary-500 animate-pulse" />
                    </div>
                </div>
                <p className="mt-6 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">
                    {t('analytics_loading') || 'Loading Analytics...'}
                </p>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                    {t('analytics_error') || 'Failed to load analytics data'}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto py-12 px-6">
            {/* Header */}
            <header className="mb-16 relative overflow-hidden">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 mb-4"
                    >
                        <span className="w-12 h-1 text-primary-500 bg-primary-500 rounded-full inline-block"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500">
                            {t('analytics_intelligence') || 'PAYMENT INTELLIGENCE'}
                        </span>
                    </motion.div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-4 leading-none">
                        {t('analytics_title') || 'Revenue Analytics Dashboard'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xl font-medium max-w-2xl leading-relaxed">
                        {t('analytics_subtitle') || 'Comprehensive insights into your subscription business performance'}
                    </p>
                </div>
            </header>

            {/* Timeframe Selector */}
            <div className="mb-8 flex gap-2">
                {(['month', 'quarter', 'year'] as const).map((period) => (
                    <button
                        key={period}
                        onClick={() => setTimeframe(period)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeframe === period
                                ? 'bg-primary-500 text-white shadow-lg'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                {/* Revenue Metrics */}
                <div className="xl:col-span-8 space-y-8">
                    {/* Key Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card p-6 bg-gradient-to-br from-green-500 to-green-600 text-white"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <DollarSign className="w-8 h-8 opacity-80" />
                                <div className={`flex items-center gap-1 text-xs font-bold ${analytics.revenue.netRevenueChange >= 0 ? 'text-green-200' : 'text-red-200'
                                    }`}>
                                    {analytics.revenue.netRevenueChange >= 0 ? (
                                        <ArrowUp className="w-3 h-3" />
                                    ) : (
                                        <ArrowDown className="w-3 h-3" />
                                    )}
                                    {formatCurrency(Math.abs(analytics.revenue.netRevenueChange))}
                                </div>
                            </div>
                            <h3 className="text-2xl font-black mb-1">{formatCurrency(analytics.revenue.mrr)}</h3>
                            <p className="text-green-100 text-sm font-medium">Monthly Recurring Revenue</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="card p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <Users className="w-8 h-8 opacity-80" />
                                <div className="flex items-center gap-1 text-xs font-bold text-blue-200">
                                    <Activity className="w-3 h-3" />
                                    {analytics.customers.activeCustomers}
                                </div>
                            </div>
                            <h3 className="text-2xl font-black mb-1">{analytics.customers.totalCustomers}</h3>
                            <p className="text-blue-100 text-sm font-medium">Total Customers</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="card p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <Target className="w-8 h-8 opacity-80" />
                                <div className={`flex items-center gap-1 text-xs font-bold ${analytics.customers.churnRate <= 5 ? 'text-green-200' : 'text-red-200'
                                    }`}>
                                    {analytics.customers.churnRate <= 5 ? (
                                        <ArrowDown className="w-3 h-3" />
                                    ) : (
                                        <ArrowUp className="w-3 h-3" />
                                    )}
                                    {formatPercentage(analytics.customers.churnRate)}
                                </div>
                            </div>
                            <h3 className="text-2xl font-black mb-1">{formatPercentage(analytics.customers.retentionRate)}</h3>
                            <p className="text-purple-100 text-sm font-medium">Customer Retention</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="card p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <CreditCard className="w-8 h-8 opacity-80" />
                                <div className="flex items-center gap-1 text-xs font-bold text-orange-200">
                                    <TrendingUp className="w-3 h-3" />
                                    {analytics.subscriptions.activeSubscriptions}
                                </div>
                            </div>
                            <h3 className="text-2xl font-black mb-1">{analytics.subscriptions.totalSubscriptions}</h3>
                            <p className="text-orange-100 text-sm font-medium">Active Subscriptions</p>
                        </motion.div>
                    </div>

                    {/* Revenue Breakdown */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card p-8"
                    >
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <BarChart3 className="w-6 h-6 text-primary-500" />
                            Revenue Breakdown
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-black text-green-600 dark:text-green-400 mb-1">
                                    {formatCurrency(analytics.revenue.newRevenue)}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">New Revenue</p>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-1">
                                    {formatCurrency(analytics.revenue.expansionRevenue)}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Expansion</p>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-black text-red-600 dark:text-red-400 mb-1">
                                    {formatCurrency(analytics.revenue.churnedRevenue)}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Churned</p>
                            </div>
                            <div className="text-center">
                                <div className={`text-2xl font-black mb-1 ${analytics.revenue.netRevenueChange >= 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}>
                                    {analytics.revenue.netRevenueChange >= 0 ? '+' : ''}
                                    {formatCurrency(analytics.revenue.netRevenueChange)}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Net Change</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Cohort Analysis */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card p-8"
                    >
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <Calendar className="w-6 h-6 text-primary-500" />
                            Customer Cohorts
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-3 px-4 font-black text-gray-900 dark:text-white">Period</th>
                                        <th className="text-center py-3 px-4 font-black text-gray-900 dark:text-white">Customers</th>
                                        <th className="text-center py-3 px-4 font-black text-gray-900 dark:text-white">Retained</th>
                                        <th className="text-center py-3 px-4 font-black text-gray-900 dark:text-white">Churned</th>
                                        <th className="text-center py-3 px-4 font-black text-gray-900 dark:text-white">Retention</th>
                                        <th className="text-center py-3 px-4 font-black text-gray-900 dark:text-white">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics.cohorts.cohorts.slice(0, 6).map((cohort) => (
                                        <tr key={cohort.period} className="border-b border-gray-100 dark:border-gray-800">
                                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                                                {cohort.period}
                                            </td>
                                            <td className="py-3 px-4 text-center font-black text-gray-900 dark:text-white">
                                                {cohort.customers}
                                            </td>
                                            <td className="py-3 px-4 text-center font-black text-green-600 dark:text-green-400">
                                                {cohort.retained}
                                            </td>
                                            <td className="py-3 px-4 text-center font-black text-red-600 dark:text-red-400">
                                                {cohort.churned}
                                            </td>
                                            <td className="py-3 px-4 text-center font-black text-blue-600 dark:text-blue-400">
                                                {formatPercentage(cohort.retentionRate)}
                                            </td>
                                            <td className="py-3 px-4 text-center font-black text-purple-600 dark:text-purple-400">
                                                {formatCurrency(cohort.revenue)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* Side Panel - Additional Analytics */}
                <div className="xl:col-span-4 space-y-8">
                    {/* Payment Methods */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="card p-6"
                    >
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <PieChart className="w-5 h-5 text-primary-500" />
                            Payment Methods
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Credit Card</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${analytics.paymentMethods.creditCardPercentage}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-black text-gray-900 dark:text-white">
                                        {formatPercentage(analytics.paymentMethods.creditCardPercentage)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">PayPal</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-indigo-500 h-2 rounded-full"
                                            style={{ width: `${analytics.paymentMethods.paypalPercentage}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-black text-gray-900 dark:text-white">
                                        {formatPercentage(analytics.paymentMethods.paypalPercentage)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Churn Prediction */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="card p-6"
                    >
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Churn Risk
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Predicted Churn Rate
                                </span>
                                <span className={`text-lg font-black ${analytics.churnPrediction.predictedChurnRate > 10
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-green-600 dark:text-green-400'
                                    }`}>
                                    {formatPercentage(analytics.churnPrediction.predictedChurnRate)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    At Risk Customers
                                </span>
                                <span className="text-lg font-black text-orange-600 dark:text-orange-400">
                                    {analytics.churnPrediction.atRiskCustomers}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-black text-gray-900 dark:text-white mb-3">Top Churn Reasons</h4>
                            <div className="space-y-2">
                                {analytics.churnPrediction.churnReasons.map((reason, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">{reason.reason}</span>
                                        <span className="font-black text-gray-900 dark:text-white">
                                            {formatPercentage(reason.percentage)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Customer LTV */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="card p-6"
                    >
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <Target className="w-5 h-5 text-primary-500" />
                            Customer Value
                        </h3>
                        <div className="text-center">
                            <div className="text-3xl font-black text-primary-600 dark:text-primary-400 mb-2">
                                {formatCurrency(analytics.customers.customerLifetimeValue)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Average Customer Lifetime Value</p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <div className="text-lg font-black text-green-600 dark:text-green-400">
                                        {analytics.customers.newCustomers}
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">New This Month</p>
                                </div>
                                <div>
                                    <div className="text-lg font-black text-red-600 dark:text-red-400">
                                        {analytics.customers.churnedCustomers}
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Churned</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default PaymentAnalyticsDashboard;