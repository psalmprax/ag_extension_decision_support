import apiClient from './client';
import { AxiosError } from 'axios';

function isAxiosError(err: unknown): err is AxiosError<{ success?: boolean; error?: string }> {
  return err instanceof AxiosError;
}

export const fetchPlans = async () => {
  try {
    const { data } = await apiClient.get('/billing/plans');
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to fetch plans',
      }
    );
  }
};

export const fetchSubscription = async () => {
  try {
    const { data } = await apiClient.get('/billing/subscription');
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to fetch subscription',
      }
    );
  }
};

export const fetchUsage = async () => {
  try {
    const { data } = await apiClient.get('/billing/usage');
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to fetch usage',
      }
    );
  }
};

export const createCheckoutSession = async (
  priceId: string,
  billingCycle: 'current' | 'next' = 'current'
) => {
  try {
    const { data } = await apiClient.post('/billing/subscribe', { priceId, billingCycle });
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to create checkout session',
      }
    );
  }
};

export const switchSubscription = async (
  priceId: string,
  billingCycle: 'current' | 'next' = 'current'
) => {
  try {
    const { data } = await apiClient.post('/billing/switch', { priceId, billingCycle });
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to switch subscription',
      }
    );
  }
};

export const createPortalSession = async () => {
  try {
    const { data } = await apiClient.post('/billing/portal');
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to create portal session',
      }
    );
  }
};

export const fetchInvoices = async () => {
  try {
    const { data } = await apiClient.get('/billing/invoices');
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to fetch invoices',
      }
    );
  }
};

export const fetchPaymentMethods = async () => {
  try {
    const { data } = await apiClient.get('/billing/payment-methods');
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to fetch payment methods',
      }
    );
  }
};

export const addPaymentMethod = async (type: string) => {
  try {
    const { data } = await apiClient.post('/billing/payment-methods', { type });
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to add payment method',
      }
    );
  }
};

export const deletePaymentMethod = async (id: string) => {
  try {
    const { data } = await apiClient.delete(`/billing/payment-methods/${id}`);
    return data;
  } catch (err: unknown) {
    return (
      (isAxiosError(err) ? err.response?.data : null) || {
        success: false,
        error: 'Failed to delete payment method',
      }
    );
  }
};

export const updateAdminConfig = async (config: {
  stripeSecretKey?: string;
  paypalClientId?: string;
}) => {
  const { data } = await apiClient.patch('/billing/admin/config', config);
  return data;
};

export const createPayPalSubscription = async (planId: string) => {
  const { data } = await apiClient.post('/billing/paypal/subscribe', { planId });
  return data;
};

// Payment Analytics API functions (Admin only)







// Voucher API functions
export const redeemVoucher = async (code: string) => {
  const { data } = await apiClient.post('/billing/voucher/redeem', { code });
  return data;
};

export const generateVouchers = async (planId: string, count: number, expiresInDays?: number) => {
  const { data } = await apiClient.post('/billing/voucher/generate', {
    planId,
    count,
    expiresInDays,
  });
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
  const { data } = await apiClient.get('/billing/transaction/list', {
    params: status ? { status } : {},
  });
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
