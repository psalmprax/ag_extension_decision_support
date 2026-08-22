import React from 'react';
import {
  CreditCard as CardIcon,
  Smartphone,
  Ticket,
  Globe,
  Plus,
  Trash2,
  Lock,
  Zap,
  CheckCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
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
  const { radiusClass } = useThemeClasses();

  return (
    <section
      aria-labelledby="payment-methods-title"
      className="card p-8 lg:p-10 bg-slate-950/90 dark:bg-slate-950/95 border border-emerald-500/25 shadow-2xl backdrop-blur-2xl group overflow-hidden relative"
      style={{ borderRadius: 'var(--radius-card, 1.25rem)' }}
    >
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl shadow-inner text-emerald-400">
            <CardIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3
              id="payment-methods-title"
              className="text-2xl font-black text-white uppercase tracking-tight"
            >
              {t('billing_payment_intelligence') || 'Payment Methods & Fast Checkout'}
            </h3>
            <p className="text-xxs font-black text-emerald-400 uppercase tracking-[0.2em]">
              {t('billing_stored_protocols') || 'Zero-Trust Mobile Money & Voucher Rails'}
            </p>
          </div>
        </div>
        <Button
          loading={actionLoading === 'add-pm'}
          onClick={() => {
            triggerHaptic('light');
            onAddMethod();
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/50"
        >
          <Plus className="w-4 h-4" />
          {t('billing_add_method') || 'Add Credit Card'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Regional Mobile Money */}
        <div
          className={`p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/30 group/pm hover:border-emerald-400/60 transition-all duration-300 relative overflow-hidden shadow-xl`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
            <Smartphone className="w-20 h-20 text-emerald-400" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 relative z-10">
              <div
                className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-center text-emerald-400 shadow-inner"
              >
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-black text-white tracking-tight">
                  M-Pesa / Airtel Money
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm">
                    Direct USSD / Till
                  </Badge>
                  <p className="text-xxs font-black text-slate-400 uppercase tracking-widest">
                    {t('billing_mobile_transfer') || 'Fast Mobile Transfer'}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                triggerHaptic('light');
                setShowMobilePayForm(!showMobilePayForm);
              }}
              className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600 hover:text-white"
            >
              {showMobilePayForm ? 'Hide' : t('action_pay_mobile') || 'Express Pay'}
            </Button>
          </div>
          {showMobilePayForm && (
            <div className="mt-4 pt-4 border-t border-emerald-500/20 space-y-3 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={mobilePayData.method}
                  onChange={e => setMobilePayData({ ...mobilePayData, method: e.target.value })}
                  options={[
                    { value: 'mpesa', label: 'M-Pesa (Till / Paybill)' },
                    { value: 'airtel', label: 'Airtel Money' },
                    { value: 'bank', label: 'Direct Bank Wire' },
                  ]}
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
                />
              </div>
              <Input
                type="text"
                value={mobilePayData.transactionId}
                onChange={e =>
                  setMobilePayData({ ...mobilePayData, transactionId: e.target.value.toUpperCase() })
                }
                placeholder="Enter M-Pesa/Airtel Ref (e.g. QKH7189XA)"
                className="font-mono text-xs uppercase"
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-400 leading-tight">
                  Instant webhook activation upon automated mobile money reconciliation.
                </p>
                <Button
                  loading={actionLoading === 'mobile-pay'}
                  disabled={!mobilePayData.transactionId || !mobilePayData.planId}
                  onClick={() => {
                    triggerHaptic('medium');
                    handleSubmitTransaction();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xxs shrink-0 shadow-md shadow-emerald-950"
                >
                  Confirm Payment
                </Button>
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
          className={`p-6 rounded-2xl bg-slate-900/80 border border-indigo-500/30 group/pm hover:border-indigo-400/60 transition-all duration-300 relative overflow-hidden shadow-xl`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
            <Ticket className="w-20 h-20 text-indigo-400" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 relative z-10">
              <div
                className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/40 rounded-xl flex items-center justify-center text-indigo-400 shadow-inner"
              >
                <Ticket className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-black text-white tracking-tight">
                  {t('billing_voucher') || 'AgriVoucher Token'}
                </p>
                <p className="text-xxs font-black text-indigo-300 uppercase tracking-widest">
                  {t('billing_voucher_desc') || 'Prepaid NGO / Cooperative Grant Code'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                triggerHaptic('light');
                setShowVoucherForm(!showVoucherForm);
              }}
              className="bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white"
            >
              {showVoucherForm ? 'Hide' : t('action_redeem') || 'Redeem'}
            </Button>
          </div>
          {showVoucherForm && (
            <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-3 relative z-10">
              <Input
                type="text"
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Enter voucher code (e.g. AGV-A1B2C3D4)"
                className="font-mono tracking-wider text-xs"
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-400">Instantly unlocks agronomist quota.</p>
                <Button
                  loading={actionLoading === 'voucher'}
                  disabled={!voucherCode.trim()}
                  onClick={() => {
                    triggerHaptic('medium');
                    handleRedeemVoucher();
                  }}
                  className="bg-indigo-600 text-white hover:bg-indigo-500 font-black uppercase tracking-widest text-xxs shrink-0 shadow-md shadow-indigo-950"
                >
                  Activate Token
                </Button>
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
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between group/pm hover:border-emerald-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-8 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center text-xs font-black text-white uppercase tracking-tighter"
                >
                  {pm.card?.brand || 'Card'}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-white tracking-tight">
                    •••• •••• •••• {pm.card?.last4}
                  </p>
                  <p className="text-xxs font-black text-slate-400 uppercase tracking-widest">
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
                className="p-2 text-slate-400 hover:text-rose-400 transition-colors opacity-0 group-hover/pm:opacity-100 disabled:opacity-50"
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
            className="col-span-2 p-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 flex flex-col items-center justify-center gap-3 text-slate-400"
          >
            <Lock className="w-7 h-7 text-slate-500" />
            <p className="text-xxs font-black uppercase tracking-[0.2em] text-slate-400">
              {t('billing_no_secure_methods') || 'No cards stored. Fast checkout active via M-Pesa & Vouchers.'}
            </p>
          </div>
        )}
      </div>

      {/* PayPal Integration */}
      <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-black text-white uppercase tracking-tighter">
              {t('billing_paypal_gateway') || 'PayPal International Billing'}
            </h4>
            <p className="text-xxs font-black text-slate-400 uppercase tracking-widest">
              {t('billing_global_p2p') || 'Global Cross-Border Subscriptions'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          loading={actionLoading === 'paypal-price_pro_monthly'}
          onClick={() => {
            triggerHaptic('medium');
            onPayPalSubscription('price_pro_monthly');
          }}
          className="bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white"
        >
          <Globe className="w-4 h-4" />
          {t('billing_subscribe_paypal') || 'PayPal Checkout'}
        </Button>
      </div>
    </section>
  );
};
