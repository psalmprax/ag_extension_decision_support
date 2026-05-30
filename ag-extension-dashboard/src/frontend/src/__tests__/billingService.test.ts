import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
    },
}));

import apiClient from '@/api/client';
import {
    fetchPlans,
    fetchSubscription,
    fetchPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    redeemVoucher,
} from '@/api/billingService';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

describe('billingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchPlans', () => {
        it('should fetch available plans', async () => {
            const mockPlans = [
                { id: 'free', name: 'Free', price: 0, features: ['Basic access'] },
                { id: 'pro', name: 'Pro', price: 29, features: ['Full access'] },
            ];
            mockGet.mockResolvedValue({ data: { success: true, data: mockPlans } });

            const result = await fetchPlans();

            expect(mockGet).toHaveBeenCalledWith('/billing/plans');
            expect(result.data).toHaveLength(2);
        });
    });

    describe('fetchSubscription', () => {
        it('should fetch current subscription', async () => {
            const mockSub = { id: 'sub-1', planId: 'pro', status: 'active' };
            mockGet.mockResolvedValue({ data: { success: true, data: mockSub } });

            const result = await fetchSubscription();

            expect(mockGet).toHaveBeenCalledWith('/billing/subscription');
            expect(result.data.planId).toBe('pro');
        });
    });

    describe('fetchPaymentMethods', () => {
        it('should fetch payment methods', async () => {
            const mockMethods = [
                { id: 'pm-1', type: 'card', brand: 'visa', last4: '4242' },
            ];
            mockGet.mockResolvedValue({ data: { success: true, data: mockMethods } });

            const result = await fetchPaymentMethods();

            expect(mockGet).toHaveBeenCalledWith('/billing/payment-methods');
            expect(result.data).toHaveLength(1);
        });
    });

    describe('addPaymentMethod', () => {
        it('should add a payment method', async () => {
            mockPost.mockResolvedValue({ data: { success: true, data: { id: 'pm-2' } } });

            const result = await addPaymentMethod('card');

            expect(mockPost).toHaveBeenCalledWith('/billing/payment-methods', { type: 'card' });
            expect(result.data.id).toBe('pm-2');
        });
    });

    describe('deletePaymentMethod', () => {
        it('should delete a payment method', async () => {
            mockDelete.mockResolvedValue({ data: { success: true } });

            await deletePaymentMethod('pm-1');

            expect(mockDelete).toHaveBeenCalledWith('/billing/payment-methods/pm-1');
        });
    });

    describe('redeemVoucher', () => {
        it('should redeem a voucher code', async () => {
            mockPost.mockResolvedValue({ data: { success: true, data: { planId: 'pro' } } });

            const result = await redeemVoucher('CODE-123');

            expect(mockPost).toHaveBeenCalledWith('/billing/voucher/redeem', { code: 'CODE-123' });
            expect(result.data.planId).toBe('pro');
        });
    });
});
