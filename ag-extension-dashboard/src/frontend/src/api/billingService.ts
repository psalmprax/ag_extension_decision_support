import apiClient from './client';

export const fetchPlans = async () => {
    try {
        const { data } = await apiClient.get('/billing/plans');
        return data;
    } catch (err: any) {
        return err.response?.data || { success: false, error: 'Failed to fetch plans' };
    }
};

export const fetchSubscription = async () => {
    try {
        const { data } = await apiClient.get('/billing/subscription');
        return data;
    } catch (err: any) {
        return err.response?.data || { success: false, error: 'Failed to fetch subscription' };
    }
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
    try {
        const { data } = await apiClient.get('/billing/invoices');
        return data;
    } catch (err: any) {
        return err.response?.data || { success: false, error: 'Failed to fetch invoices' };
    }
};

export const fetchPaymentMethods = async () => {
    try {
        const { data } = await apiClient.get('/billing/payment-methods');
        return data;
    } catch (err: any) {
        return err.response?.data || { success: false, error: 'Failed to fetch payment methods' };
    }
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

// Voucher API functions
export const redeemVoucher = async (code: string) => {
    const { data } = await apiClient.post('/billing/voucher/redeem', { code });
    return data;
};

export const generateVouchers = async (planId: string, count: number, expiresInDays?: number) => {
    const { data } = await apiClient.post('/billing/voucher/generate', { planId, count, expiresInDays });
    return data;
};

export const listVouchers = async (filters?: { planId?: string; isRedeemed?: boolean }) => {
    const { data } = await apiClient.get('/billing/voucher/list', { params: filters });
    return data;
};

// Transaction submission API functions (M-Pesa / Airtel / Bank)
export const submitTransaction = async (params: {
    planId: string;
    method: 'mpesa' | 'airtel' | 'bank';
    transactionId: string;
    amount: number;
    currency?: string;
}) => {
    const { data } = await apiClient.post('/billing/transaction/submit', params);
    return data;
};

export const getMyTransactions = async () => {
    const { data } = await apiClient.get('/billing/transaction/my');
    return data;
};

export const listAllTransactions = async (status?: string) => {
    const { data } = await apiClient.get('/billing/transaction/list', { params: status ? { status } : {} });
    return data;
};

export const verifyTransaction = async (id: string) => {
    const { data } = await apiClient.post(`/billing/transaction/verify/${id}`);
    return data;
};

export const rejectTransaction = async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/billing/transaction/reject/${id}`, { reason });
    return data;
};
