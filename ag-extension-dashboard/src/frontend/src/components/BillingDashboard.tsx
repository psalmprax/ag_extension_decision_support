import React from 'react';
import { CreditCard, AlertCircle, Settings, Shield, Ticket } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { motion } from 'framer-motion';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useLanguage } from '@/lib/LanguageContext';
import { UsageQuota } from './UsageQuota';
import { ConfirmModal } from './ConfirmModal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Dialog, DialogTitle, DialogContent, DialogActions } from './ui/Dialog';
import { Textarea } from './ui/Textarea';
import { SubscriptionStatus } from './billing/SubscriptionStatus';
import { PlanCard } from './billing/PlanCard';
import { PaymentMethods } from './billing/PaymentMethods';
import { Invoices } from './billing/Invoices';
import { AccessAndCostMatrix } from './billing/AccessAndCostMatrix';

export const BillingDashboard: React.FC = () => {
  const { headingClass, radiusClass } = useThemeClasses();
  const { t } = useLanguage();
  const billing = useBillingActions();

  if (billing.loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-[60vh]"
        role="status"
        aria-label="Loading billing data"
      >
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-primary-500 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest text-xxs animate-pulse">
          {t('billing_syncing')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-6">
      {/* Configuration Alert Banner */}
      {(billing.configErrors.stripe || billing.configErrors.paypal) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-6 bg-amber-500/10 border-2 border-amber-500/50 ${radiusClass} flex items-start gap-4`}
        >
          <AlertCircle className="w-6 h-6 text-amber-500 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-amber-500 font-black uppercase tracking-widest text-[12px] mb-1">
              {t('billing_configuration_alert') || 'PAYMENT GATEWAY CONFIGURATION REQUIRED'}
            </h3>
            <p className="text-amber-500/80 font-bold text-sm">
              {billing.user?.role === 'admin'
                ? 'Action Required: Stripe or PayPal API keys are missing. Please update your credentials in the Admin Vault section below to enable card and PayPal payments.'
                : 'Note: We are currently updating our payment gateways. Some card and PayPal features may be temporarily unavailable. Please use Vouchers or Mobile Money in the meantime.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Success/Cancel Messages */}
      {billing.success && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${radiusClass} flex items-center gap-3`}
        >
          <span className="text-green-800 dark:text-green-200 font-medium">
            {t('subscription_success') || 'Subscription successful! Thank you for subscribing.'}
          </span>
        </motion.div>
      )}
      {billing.canceled && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 ${radiusClass} flex items-center gap-3`}
        >
          <span className="text-yellow-800 dark:text-yellow-200 font-medium">
            {t('subscription_canceled') || 'Subscription was canceled. You can try again anytime.'}
          </span>
        </motion.div>
      )}

      <header className="mb-12 relative overflow-hidden p-8 rounded-3xl bg-slate-900/80 dark:bg-slate-950/80 border border-emerald-500/20 backdrop-blur-2xl shadow-2xl">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 mb-3"
            >
              <span className="w-8 h-1 bg-emerald-400 rounded-full inline-block" />
              <span className="text-xxs font-black uppercase tracking-[0.25em] text-emerald-400">
                {t('billing_account_control') || 'AG-EXTENSION COMMERCE & SEATS'}
              </span>
            </motion.div>
            <h1 className={`text-4xl font-black tracking-tight mb-3 text-white ${headingClass}`}>
              Billing & Subscriptions
            </h1>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              {t('billing_subtitle') || 'Manage individual farmer quotas, cooperative multi-county extension officer pools, and automated billing methods.'}
            </p>
          </div>

          {/* KnockKnock-Style Billing Cycle Toggle */}
          <div className="flex items-center gap-3 p-1.5 bg-slate-950/90 rounded-2xl border border-slate-800 backdrop-blur-md shadow-inner">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md shadow-emerald-950"
            >
              Monthly Billing
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
        {/* Left Column: Current Plan & Controls */}
        <div className="xl:col-span-4 space-y-12 h-full">
          <SubscriptionStatus
            subscription={
              billing.subscription as unknown as {
                [key: string]: unknown;
                plan?: { name?: string | undefined };
                currentPeriodEnd?: string | undefined;
              } | null
            }
            onPortal={() => {
              void billing.handlePortal();
            }}
            actionLoading={billing.actionLoading}
          />
          <section aria-label="Usage Intelligence">
            <UsageQuota />
          </section>
        </div>

        {/* Right Area: Plans & Invoices */}
        <div className="xl:col-span-8 space-y-12">
          {/* Plans Grid */}
          <section
            aria-label="Available subscription plans"
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch"
          >
            {billing.plans.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={idx}
                isCurrentPlan={billing.subscription?.plan.id === plan.id}
                onSelect={billing.handleSubscribe}
                actionLoading={billing.actionLoading}
              />
            ))}
          </section>

          {/* Feature Access & Cost Matrix */}
          <section aria-label="Feature Access and Cost Matrix">
            <AccessAndCostMatrix onSelectPlan={billing.handleSubscribe} />
          </section>

          {/* Payment Methods Section */}
          <PaymentMethods
            paymentMethods={billing.paymentMethods}
            plans={billing.plans}
            onAddMethod={billing.handleAddMethod}
            onDeleteMethod={billing.handleDeleteMethod}
            onPayPalSubscription={billing.handlePayPalSubscription}
            actionLoading={billing.actionLoading}
            showMobilePayForm={billing.showMobilePayForm}
            setShowMobilePayForm={billing.setShowMobilePayForm}
            mobilePayData={
              billing.mobilePayData as unknown as {
                method: string;
                planId: string;
                transactionId: string;
                amount?: string | undefined;
              }
            }
            setMobilePayData={
              billing.setMobilePayData as unknown as (data: {
                method: string;
                planId: string;
                transactionId: string;
                amount?: string | undefined;
              }) => void
            }
            handleSubmitTransaction={billing.handleSubmitTransaction}
            showVoucherForm={billing.showVoucherForm}
            setShowVoucherForm={billing.setShowVoucherForm}
            voucherCode={billing.voucherCode}
            setVoucherCode={billing.setVoucherCode}
            handleRedeemVoucher={billing.handleRedeemVoucher}
            formMessage={billing.formMessage}
          />

          {/* Admin Billing Settings */}
          {billing.user?.role === 'admin' && (
            <section
              aria-labelledby="admin-billing-title"
              className="card p-10 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 shadow-xl rounded-[2.5rem] relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Settings className="w-32 h-32 text-indigo-500" />
              </div>
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1">
                  <h3
                    id="admin-billing-title"
                    className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter"
                  >
                    {t('billing_admin_vault_title')}
                  </h3>
                  <p className="text-xxs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">
                    {t('billing_admin_vault_subtitle')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      {t('billing_stripe_secret')}
                    </p>
                    <Input
                      type="password"
                      value={billing.adminKeys.stripeSecretKey}
                      onChange={e =>
                        billing.setAdminKeys({
                          ...billing.adminKeys,
                          stripeSecretKey: e.target.value,
                        })
                      }
                      placeholder="sk_test_••••••••••••••••••••••••"
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      {t('billing_paypal_id')}
                    </p>
                    <Input
                      type="text"
                      value={billing.adminKeys.paypalClientId}
                      onChange={e =>
                        billing.setAdminKeys({
                          ...billing.adminKeys,
                          paypalClientId: e.target.value,
                        })
                      }
                      placeholder="Client ID"
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-800 text-xxs font-black text-gray-400 uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5" />
                  {t('billing_secure_storage')}
                </span>
                <Button
                  loading={billing.actionLoading === 'admin-update'}
                  onClick={billing.handleAdminUpdate}
                >
                  {t('billing_update_credentials')}
                </Button>
              </div>
            </section>
          )}

          {/* Invoices */}
          <Invoices invoices={billing.invoices} />

          {/* Admin Audit & Voucher Management */}
          {billing.user?.role === 'admin' && (
            <div className="space-y-8 mt-12 pb-20">
              <section className="card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-amber-500/10 rounded-2xl shadow-inner">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                      {t('billing_admin_transactions')}
                    </h3>
                    <p className="text-xxs font-black text-amber-500 uppercase tracking-[0.2em]">
                      Manual Verification Required
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/30 dark:bg-gray-800/20">
                        {['User', 'Method', 'TX ID', 'Amount', 'Plan', 'Actions'].map(h => (
                          <th
                            key={h}
                            className="px-6 py-4 text-xxs font-black uppercase text-gray-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {billing.adminTransactions.length > 0 ? (
                        billing.adminTransactions.map(tx => (
                          <tr
                            key={tx.id}
                            className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors"
                          >
                            <td className="px-6 py-4 text-xs font-bold">{tx.userEmail}</td>
                            <td className="px-6 py-4 text-xs font-black uppercase text-amber-600">
                              {tx.method}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono">{tx.transactionId}</td>
                            <td className="px-6 py-4 text-xs font-black">
                              {tx.amount} {tx.currency}
                            </td>
                            <td className="px-6 py-4 text-xs uppercase">
                              {tx.planId?.split('_')[1]}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  loading={billing.actionLoading === `verify-${tx.id}`}
                                  onClick={() => billing.handleVerifyTransaction(tx.id)}
                                  className="bg-green-500 text-white hover:bg-green-600 text-xxs font-black uppercase tracking-widest"
                                >
                                  {t('billing_admin_verify')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => billing.setSelectedTransactionId(tx.id)}
                                  className="text-xxs font-black uppercase tracking-widest"
                                >
                                  {t('billing_admin_reject')}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-10 text-center text-xs text-gray-400 font-bold uppercase tracking-widest italic"
                          >
                            {t('billing_admin_no_pending')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-purple-500/10 rounded-2xl shadow-inner">
                    <Ticket className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                      {t('billing_admin_vouchers')}
                    </h3>
                    <p className="text-xxs font-black text-purple-500 uppercase tracking-[0.2em]">
                      Batch Generation Unit
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <label className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">
                      Plan
                    </label>
                    <Select
                      value={billing.voucherBatch.planId}
                      onChange={e =>
                        billing.setVoucherBatch({ ...billing.voucherBatch, planId: e.target.value })
                      }
                      options={[
                        { value: 'price_pro_monthly', label: 'PRO (Monthly)' },
                        { value: 'price_pro_yearly', label: 'PRO (Yearly)' },
                        { value: 'price_enterprise_monthly', label: 'ENTERPRISE (Monthly)' },
                      ]}
                      className="font-black uppercase tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">
                      {t('billing_admin_batch_count')}
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
                    />
                  </div>
                  <div>
                    <label className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">
                      {t('billing_admin_expiry_days')}
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
                    />
                  </div>
                </div>
                <Button
                  loading={billing.actionLoading === 'generate-vouchers'}
                  onClick={billing.handleGenerateVouchers}
                  className="w-full py-4 bg-purple-500 text-white rounded-2xl hover:bg-purple-600 shadow-lg shadow-purple-500/20 font-black uppercase tracking-widest text-xs"
                >
                  {t('billing_admin_generate_vouchers')}
                </Button>
              </section>
            </div>
          )}

          {/* Rejection Modal */}
          <Dialog
            open={!!billing.selectedTransactionId}
            onClose={() => billing.setSelectedTransactionId(null)}
            size="md"
          >
            <DialogContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-500/10 rounded-2xl shadow-inner">
                  <span className="w-6 h-6 text-red-500" />
                </div>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                  Reject Transaction
                </DialogTitle>
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">
                {t('billing_admin_pending_reason')}
              </p>
              <Textarea
                value={billing.rejectReason}
                onChange={e => billing.setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="mb-6"
              />
            </DialogContent>
            <DialogActions>
              <Button variant="ghost" onClick={() => billing.setSelectedTransactionId(null)}>
                {t('common_cancel')}
              </Button>
              <Button
                variant="danger"
                loading={billing.actionLoading?.startsWith('reject-')}
                onClick={billing.handleRejectTransaction}
              >
                {t('billing_admin_reject')}
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      </div>
      {billing.confirmModal && (
        <ConfirmModal
          isOpen={!!billing.confirmModal}
          onClose={() => billing.setConfirmModal(null)}
          onConfirm={billing.confirmModal.onConfirm}
          title={billing.confirmModal.title}
          message={billing.confirmModal.message}
          variant={billing.confirmModal.variant}
          confirmText={billing.confirmModal.confirmText}
        />
      )}
    </div>
  );
};

export default BillingDashboard;
