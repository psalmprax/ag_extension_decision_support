/**
 * A saved card is detached only for the customer it belongs to: a card id alone,
 * guessed or copied from another account, never removes someone else's card.
 */
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/services/prismaService', () => ({ getPrisma: () => ({}) }));

import { paymentService } from '@/services/paymentService';

const stripe = {
  paymentMethods: { retrieve: jest.fn(), detach: jest.fn() },
};

beforeAll(async () => {
  await paymentService.whenReady();
  (paymentService as unknown as { stripe: typeof stripe }).stripe = stripe;
});

beforeEach(() => {
  stripe.paymentMethods.retrieve.mockReset();
  stripe.paymentMethods.detach.mockReset().mockResolvedValue({});
});

describe('paymentService.deletePaymentMethod', () => {
  it('detaches a card that belongs to the customer', async () => {
    stripe.paymentMethods.retrieve.mockResolvedValue({ id: 'pm_own', customer: 'cus_amina' });
    const result = await paymentService.deletePaymentMethod('pm_own', 'cus_amina');
    expect(result.success).toBe(true);
    expect(stripe.paymentMethods.detach).toHaveBeenCalledWith('pm_own');
  });

  it("refuses another customer's card and leaves it attached", async () => {
    stripe.paymentMethods.retrieve.mockResolvedValue({ id: 'pm_other', customer: { id: 'cus_baraka' } });
    const result = await paymentService.deletePaymentMethod('pm_other', 'cus_amina');
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'PAYMENT_METHOD_NOT_FOUND' }));
    expect(stripe.paymentMethods.detach).not.toHaveBeenCalled();
  });

  it('refuses a card that is attached to no customer', async () => {
    stripe.paymentMethods.retrieve.mockResolvedValue({ id: 'pm_loose', customer: null });
    const result = await paymentService.deletePaymentMethod('pm_loose', 'cus_amina');
    expect(result.success).toBe(false);
    expect(stripe.paymentMethods.detach).not.toHaveBeenCalled();
  });
});
