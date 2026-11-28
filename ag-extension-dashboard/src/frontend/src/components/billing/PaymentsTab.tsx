import type { useBillingActions } from '@/hooks/useBillingActions';
import { BILLING_ENABLED } from '@ag-extension/shared/api';
import { PaymentMethods } from './PaymentMethods';
import { VoucherRedeem } from './VoucherRedeem';

type MobilePayData = { method: string; planId: string; transactionId: string; amount?: string | undefined };

/**
 * The payments tab of Billing. While billing is off nothing can be bought, so it shows only voucher
 * redemption: a voucher is a prepaid grant code, and the server keeps accepting it.
 */
export const PaymentsTab: React.FC<{ billing: ReturnType<typeof useBillingActions> }> = ({ billing }) => {
  const voucher = {
    showVoucherForm: billing.showVoucherForm,
    setShowVoucherForm: billing.setShowVoucherForm,
    voucherCode: billing.voucherCode,
    setVoucherCode: billing.setVoucherCode,
    handleRedeemVoucher: billing.handleRedeemVoucher,
    actionLoading: billing.actionLoading,
    formMessage: billing.formMessage,
  };
  if (!BILLING_ENABLED) return <VoucherRedeem {...voucher} />;
  return (
    <PaymentMethods
      {...voucher}
      paymentMethods={billing.paymentMethods}
      plans={billing.plans}
      onAddMethod={billing.handleAddMethod}
      onDeleteMethod={billing.handleDeleteMethod}
      onPayPalSubscription={billing.handlePayPalSubscription}
      showMobilePayForm={billing.showMobilePayForm}
      setShowMobilePayForm={billing.setShowMobilePayForm}
      mobilePayData={billing.mobilePayData as unknown as MobilePayData}
      setMobilePayData={billing.setMobilePayData as unknown as (data: MobilePayData) => void}
      handleSubmitTransaction={billing.handleSubmitTransaction}
    />
  );
};
