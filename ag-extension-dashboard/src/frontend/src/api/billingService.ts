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
