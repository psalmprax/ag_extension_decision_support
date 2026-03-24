import apiClient from './client';

export const fetchPlans = async () => {
    const { data } = await apiClient.get('/billing/plans');
    return data;
};

export const fetchSubscription = async () => {
    const { data } = await apiClient.get('/billing/subscription');
    return data;
};

export const fetchUsage = async () => {
    const { data } = await apiClient.get('/billing/usage');
    return data;
};

export const createCheckoutSession = async (priceId: string, billingCycle: 'current' | 'next' = 'current') => {
    const { data } = await apiClient.post('/billing/subscribe', { priceId, billingCycle });
    return data;
};

export const switchSubscription = async (priceId: string, billingCycle: 'current' | 'next' = 'current') => {
    const { data } = await apiClient.post('/billing/switch', { priceId, billingCycle });
    return data;
};

export const cancelSubscription = async () => {
    const { data } = await apiClient.post('/billing/cancel');
    return data;
};

export const createPortalSession = async () => {
    const { data } = await apiClient.post('/billing/portal');
    return data;
};

export const fetchInvoices = async () => {
    const { data } = await apiClient.get('/billing/invoices');
    return data;
};

export const fetchPaymentMethods = async () => {
    const { data } = await apiClient.get('/billing/payment-methods');
    return data;
};

export const addPaymentMethod = async (type: string) => {
    const { data } = await apiClient.post('/billing/payment-methods', { type });
    return data;
};

export const deletePaymentMethod = async (id: string) => {
    const { data } = await apiClient.delete(`/billing/payment-methods/${id}`);
    return data;
};

export const updateAdminConfig = async (config: { stripeSecretKey?: string; paypalClientId?: string }) => {
    const { data } = await apiClient.patch('/billing/admin/config', config);
    return data;
};

export const createPayPalSubscription = async (planId: string) => {
    const { data } = await apiClient.post('/billing/paypal/subscribe', { planId });
    return data;
};

// Payment Analytics API functions (Admin only)
export const getAnalyticsDashboard = async () => {
    const { data } = await apiClient.get('/billing/analytics/dashboard');
    return data;
};

export const getRevenueAnalytics = async (timeframe: 'month' | 'quarter' | 'year' = 'month') => {
    const { data } = await apiClient.get('/billing/analytics/revenue', { params: { timeframe } });
    return data;
};

export const getCustomerAnalytics = async () => {
    const { data } = await apiClient.get('/billing/analytics/customers');
    return data;
};

export const getSubscriptionAnalytics = async () => {
    const { data } = await apiClient.get('/billing/analytics/subscriptions');
    return data;
};

export const getPaymentMethodAnalytics = async () => {
    const { data } = await apiClient.get('/billing/analytics/payment-methods');
    return data;
};

export const getChurnAnalytics = async () => {
    const { data } = await apiClient.get('/billing/analytics/churn');
    return data;
};

export const getCohortAnalytics = async () => {
    const { data } = await apiClient.get('/billing/analytics/cohorts');
    return data;
};
