import {
  CreditCard as CardIcon,
  Smartphone,
  Ticket,
  Globe,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { triggerHaptic } from '@/lib/haptics';

interface PaymentMethodsProps {
  paymentMethods: Array<{
    id?: string;
    card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
  }>;
  plans: Array<{ id: string; name: string; price: number }>;
  onAddMethod: () => void;
  onDeleteMethod: (id: string) => void;
  onPayPalSubscription: (planId: string) => void;
  actionLoading: string | null;
  showMobilePayForm: boolean;
  setShowMobilePayForm: (show: boolean) => void;
  mobilePayData: { method: string; planId: string; transactionId: string; amount?: string };
  setMobilePayData: (data: {
    method: string;
    planId: string;
    transactionId: string;
    amount?: string;
  }) => void;
  handleSubmitTransaction: () => void;
  showVoucherForm: boolean;
  setShowVoucherForm: (show: boolean) => void;
  voucherCode: string;
  setVoucherCode: (code: string) => void;
  handleRedeemVoucher: () => void;
  formMessage: { type: string; text: string } | null;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  paymentMethods,
  plans,
  onAddMethod,
  onDeleteMethod,
  onPayPalSubscription,
  actionLoading,
  showMobilePayForm,
  setShowMobilePayForm,
  mobilePayData,
  setMobilePayData,
  handleSubmitTransaction,
  showVoucherForm,
  setShowVoucherForm,
  voucherCode,
  setVoucherCode,
  handleRedeemVoucher,
  formMessage,
}) => {
  const { t } = useLanguage();

  return (
    <section
      aria-labelledby="payment-methods-title"
      className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl overflow-hidden relative"
    >
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40 text-emerald-400">
            <CardIcon className="w-6 h-6" />
          </div>
          <div>
            <h3
              id="payment-methods-title"
              className="text-xl font-bold tracking-tight text-white"
            >
              {t('billing_payment_intelligence') || 'Payment Methods & Fast Checkout'}
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              {t('billing_stored_protocols') || 'Zero-Trust Mobile Money & Voucher Rails'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic('light');
            onAddMethod();
          }}
          disabled={actionLoading === 'add-pm'}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('billing_add_method') || 'Add Credit Card'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Regional Mobile Money */}
        <div
          className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all duration-300 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5 relative z-10">
              <div
                className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 shadow-inner"
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">
                  M-Pesa / Airtel Money
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mt-0.5">
                  Direct USSD / Till
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowMobilePayForm(!showMobilePayForm);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600 hover:text-white text-xxs font-bold uppercase tracking-wider transition-all"
            >
              {showMobilePayForm ? 'Hide' : t('action_pay_mobile') || 'Express Pay'}
            </button>
          </div>
          {showMobilePayForm && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={mobilePayData.method}
                  onChange={e => setMobilePayData({ ...mobilePayData, method: e.target.value })}
                  options={[
                    { value: 'mpesa', label: 'M-Pesa (Till / Paybill)' },
                    { value: 'airtel', label: 'Airtel Money' },
                    { value: 'bank', label: 'Direct Bank Wire' },
                  ]}
                  className="bg-slate-900 border-white/10 text-white rounded-xl text-xs"
                />
                <Select
                  value={mobilePayData.planId}
                  onChange={e => {
                    const p = plans.find(pl => pl.id === e.target.value);
                    setMobilePayData({
                      ...mobilePayData,
                      planId: e.target.value,
                      amount: p ? (p.price / 100).toString() : '',
                    });
                  }}
                  options={[
                    { value: '', label: 'Select Tier' },
                    ...plans
                      .filter((p: { id: string; name: string; price: number }) => p.price > 0)
                      .map((p: { id: string; name: string; price: number }) => ({
                        value: p.id,
                        label: `${p.name} ($${(p.price / 100).toFixed(2)}/mo)`,
                      })),
                  ]}
                  className="bg-slate-900 border-white/10 text-white rounded-xl text-xs"
                />
              </div>
              <Input
                type="text"
                value={mobilePayData.transactionId}
                onChange={e =>
                  setMobilePayData({ ...mobilePayData, transactionId: e.target.value.toUpperCase() })
                }
                placeholder="Enter M-Pesa/Airtel Ref (e.g. QKH7189XA)"
                className="font-mono text-xs uppercase bg-white/[0.03] border-white/10 text-white rounded-xl"
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-white/50 leading-tight">
                  Instant webhook activation upon automated mobile money reconciliation.
                </p>
                <button
                  disabled={!mobilePayData.transactionId || !mobilePayData.planId || actionLoading === 'mobile-pay'}
                  onClick={() => {
                    triggerHaptic('medium');
                    handleSubmitTransaction();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
                >
                  Confirm Payment
                </button>
              </div>
              {formMessage && (
                <p
                  className={`text-xs font-medium ${formMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {formMessage.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* AgriVoucher Option */}
        <div
          className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5 relative z-10">
              <div
                className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 shadow-inner"
              >
                <Ticket className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">
                  {t('billing_voucher') || 'AgriVoucher Token'}
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mt-0.5">
                  {t('billing_voucher_desc') || 'Prepaid NGO / Grant Code'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowVoucherForm(!showVoucherForm);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white text-xxs font-bold uppercase tracking-wider transition-all"
            >
              {showVoucherForm ? 'Hide' : t('action_redeem') || 'Redeem'}
            </button>
          </div>
          {showVoucherForm && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3 relative z-10">
              <Input
                type="text"
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Enter voucher code (e.g. AGV-A1B2C3D4)"
                className="font-mono tracking-wider text-xs bg-white/[0.03] border-white/10 text-white rounded-xl"
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-white/50">Instantly unlocks agronomist quota.</p>
                <button
                  disabled={!voucherCode.trim() || actionLoading === 'voucher'}
                  onClick={() => {
                    triggerHaptic('medium');
                    handleRedeemVoucher();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
                >
                  Activate Token
                </button>
              </div>
              {formMessage && (
                <p
                  className={`text-xs font-medium ${formMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {formMessage.text}
                </p>
              )}
            </div>
          )}
        </div>

        {paymentMethods.length > 0 ? (
          paymentMethods.map(pm => (
            <div
              key={pm.id}
              className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between group/pm hover:border-emerald-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-xs font-bold text-white uppercase tracking-tighter"
                >
                  {pm.card?.brand || 'Card'}
                </div>
                <div>
                  <p className="text-sm font-bold text-white tracking-tight">
                    •••• •••• •••• {pm.card?.last4}
                  </p>
                  <p className="text-xxs text-white/50">
                    {t('billing_expires').replace(
                      '{date}',
                      `${pm.card?.exp_month}/${pm.card?.exp_year}`
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  if (pm.id) onDeleteMethod(pm.id);
                }}
                disabled={actionLoading === `delete-${pm.id}`}
                className="p-2 text-white/40 hover:text-rose-400 transition-colors opacity-0 group-hover/pm:opacity-100 disabled:opacity-50"
              >
                {actionLoading === `delete-${pm.id}` ? (
                  <div className="w-4 h-4 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))
        ) : (
          <div
            className="col-span-2 p-6 border border-dashed border-white/10 rounded-xl bg-white/[0.01] flex flex-col items-center justify-center gap-2 text-white/50"
          >
            <Lock className="w-6 h-6 text-white/40" />
            <p className="text-xs text-white/50 font-medium">
              {t('billing_no_secure_methods') || 'No cards stored. Fast checkout active via M-Pesa & Vouchers.'}
            </p>
          </div>
        )}
      </div>

      {/* PayPal Integration */}
      <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              {t('billing_paypal_gateway') || 'PayPal International Billing'}
            </h4>
            <p className="text-xs text-white/60">
              {t('billing_global_p2p') || 'Global Cross-Border Subscriptions'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic('medium');
            onPayPalSubscription('price_pro_monthly');
          }}
          disabled={actionLoading === 'paypal-price_pro_monthly'}
          className="px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white text-xs font-bold transition-all flex items-center gap-2"
        >
          <Globe className="w-4 h-4" />
          <span>{t('billing_subscribe_paypal') || 'PayPal Checkout'}</span>
        </button>
      </div>
    </section>
  );
};
