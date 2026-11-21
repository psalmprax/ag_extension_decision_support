import React from 'react';
import { AlertCircle, ShieldCheck, Ticket } from 'lucide-react';
import type { useBillingActions } from '@/hooks/useBillingActions';
import { useLanguage } from '@/lib/LanguageContext';
import { triggerHaptic } from '@/lib/haptics';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface ManualPlanGrantsProps {
  billing: ReturnType<typeof useBillingActions>;
}

/**
 * Approving a manual (mobile-money) payment and minting vouchers both give an account a
 * paid plan without a card payment: manual upgrades, reserved for the system
 * administrator. The server refuses these calls from anyone else; other admins see why.
 */
export const ManualPlanGrants: React.FC<ManualPlanGrantsProps> = ({ billing }) => {
  const { t } = useLanguage();

  if (!billing.user?.isSystemAdmin) {
    return (
      <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-slate-500 dark:text-white/50 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600 dark:text-white/70">
          {t(
            'billing_manual_grants_system_admin_only',
            'Approving manual payments and minting vouchers upgrade accounts without a card payment, so only the system administrator can do them.'
          )}
        </p>
      </section>
    );
  }

  return (
    <>
      {/* Admin Mobile Money Verification Queue */}
      <section className="backdrop-blur-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-xl overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-medium tracking-tight text-slate-900 dark:text-white">
              {t('billing_admin_transactions') || 'Pending mobile money queue'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
              {t('ui_manual_plan_grants_manual_ussd_till_verification')}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10">
                {['User', 'Method', 'TX ID', 'Amount', 'Plan', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xxs font-medium text-slate-600 dark:text-white/60"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {billing.adminTransactions.length > 0 ? (
                billing.adminTransactions.map(tx => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 text-xs font-medium text-slate-900 dark:text-white">
                      {tx.userEmail}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {tx.method}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-700 dark:text-white/80">
                      {tx.transactionId}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-900 dark:text-white">
                      {tx.amount} {tx.currency}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-white/60 font-medium">
                      {tx.planId?.split('_')[1]}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            triggerHaptic('medium');
                            billing.handleVerifyTransaction(tx.id);
                          }}
                          disabled={billing.actionLoading === `verify-${tx.id}`}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xxs font-medium rounded-lg shadow-sm"
                        >
                          {t('billing_admin_verify') || 'Verify'}
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic('light');
                            billing.setSelectedTransactionId(tx.id);
                          }}
                          className="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white text-xxs font-medium rounded-lg shadow-sm"
                        >
                          {t('billing_admin_reject') || 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-xs text-slate-500 dark:text-white/40 font-medium italic"
                  >
                    {t('billing_admin_no_pending') || 'No pending mobile money transactions'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Voucher Generator */}
      <section className="backdrop-blur-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-xl overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-medium tracking-tight text-slate-900 dark:text-white">
              {t('billing_admin_vouchers') || 'AgriVoucher Minting Engine'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
              {t('ui_manual_plan_grants_batch_generation_for_cooperatives_ng')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">{t('ui_manual_plan_grants_target_tier')}</label>
            <Select
              value={billing.voucherBatch.planId}
              onChange={e =>
                billing.setVoucherBatch({ ...billing.voucherBatch, planId: e.target.value })
              }
              options={[
                { value: 'price_pro_monthly', label: 'Pro Officer (Monthly)' },
                { value: 'price_pro_yearly', label: 'Pro Officer (Yearly)' },
                { value: 'price_enterprise_monthly', label: 'Enterprise Cooperative' },
              ]}
              className="font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              {t('billing_admin_batch_count') || 'Tokens Count'}
            </label>
            <Input
              type="number"
              value={billing.voucherBatch.count}
              onChange={e =>
                billing.setVoucherBatch({
                  ...billing.voucherBatch,
                  count: parseInt(e.target.value),
                })
              }
              className="bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              {t('billing_admin_expiry_days') || 'Expiry (days)'}
            </label>
            <Input
              type="number"
              value={billing.voucherBatch.expiresInDays}
              onChange={e =>
                billing.setVoucherBatch({
                  ...billing.voucherBatch,
                  expiresInDays: parseInt(e.target.value),
                })
              }
              className="bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl text-xs"
            />
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic('medium');
            billing.handleGenerateVouchers();
          }}
          disabled={billing.actionLoading === 'generate-vouchers'}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-white/10 transition-colors flex items-center justify-center gap-2"
        >
          {t('billing_admin_generate_vouchers') || 'Mint batch vouchers'}
        </button>
      </section>
    </>
  );
};
