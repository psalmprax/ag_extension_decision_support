import React, { useState } from 'react';
import { CreditCard, AlertCircle, Settings, Shield, Ticket, Sparkles, Droplets } from 'lucide-react';
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
import { LiquidToggleSwitch } from './canvasui/LiquidToggleSwitch';
import { triggerHaptic } from '@/lib/haptics';

export const BillingDashboard: React.FC = () => {
  const { headingClass, radiusClass } = useThemeClasses();
  const { t } = useLanguage();
  const billing = useBillingActions();
  const [isAnnual, setIsAnnual] = useState(false);

  if (billing.loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-[60vh]"
        role="status"
        aria-label="Loading billing data"
      >
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-slate-400 font-black uppercase tracking-widest text-xxs animate-pulse">
          {t('billing_syncing') || 'Synchronizing Billing Rails...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto py-10 px-4 sm:px-6 space-y-10">
      {/* Configuration Alert Banner */}
      {(billing.configErrors.stripe || billing.configErrors.paypal) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-6 bg-amber-500/10 border-2 border-amber-500/50 ${radiusClass} flex items-start gap-4 shadow-xl backdrop-blur-xl`}
        >
          <AlertCircle className="w-6 h-6 text-amber-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-amber-400 font-black uppercase tracking-widest text-[12px] mb-1">
              {t('billing_configuration_alert') || 'PAYMENT GATEWAY CONFIGURATION REQUIRED'}
            </h3>
            <p className="text-amber-300/80 font-bold text-sm">
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
          className={`p-4 bg-emerald-500/10 border border-emerald-500/40 ${radiusClass} flex items-center gap-3 shadow-lg`}
        >
          <span className="text-emerald-300 font-medium text-sm">
            {t('subscription_success') || 'Subscription successful! Thank you for subscribing.'}
          </span>
        </motion.div>
      )}
      {billing.canceled && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-4 bg-amber-500/10 border border-amber-500/40 ${radiusClass} flex items-center gap-3 shadow-lg`}
        >
          <span className="text-amber-300 font-medium text-sm">
            {t('subscription_canceled') || 'Subscription was canceled. You can try again anytime.'}
          </span>
        </motion.div>
      )}

      {/* Header Banner with KnockKnock Glass & Canvas Controls */}
      <header className="relative overflow-hidden p-8 lg:p-10 rounded-3xl bg-slate-950/90 dark:bg-slate-950/95 border border-emerald-500/25 backdrop-blur-2xl shadow-2xl">
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

          <div className="flex flex-wrap items-center gap-4">
            {/* CanvasUI Liquid Toggle Switch */}
            <LiquidToggleSwitch compact={false} />

            {/* KnockKnock-Style Billing Cycle Toggle */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 backdrop-blur-md shadow-inner">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAnnual(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  !isAnnual
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAnnual(true);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isAnnual
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SAVE 20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column: Current Plan & Quota Telemetry */}
        <div className="xl:col-span-4 space-y-8 h-full">
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

        {/* Right Area: Plans, Matrix & Payments */}
        <div className="xl:col-span-8 space-y-10">
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
                isAnnual={isAnnual}
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
              className="p-8 backdrop-blur-xl bg-slate-900/60 border border-indigo-500/30 shadow-2xl rounded-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Settings className="w-32 h-32 text-indigo-400" />
              </div>
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-indigo-500/20 border border-indigo-500/40 rounded-xl shadow-lg shadow-indigo-950/40">
                  <Shield className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <h3
                    id="admin-billing-title"
                    className="text-xl font-black text-white uppercase tracking-tight"
                  >
                    {t('billing_admin_vault_title')}
                  </h3>
                  <p className="text-xxs font-bold text-indigo-400 uppercase tracking-[0.2em]">
                    {t('billing_admin_vault_subtitle')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <p className="text-xxs font-bold text-white/60 uppercase tracking-widest ml-1">
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
                    className="font-mono bg-white/[0.03] border-white/10 text-white rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xxs font-bold text-white/60 uppercase tracking-widest ml-1">
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
                    className="font-mono bg-white/[0.03] border-white/10 text-white rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-white/10 text-xxs font-bold text-white/50 uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  {t('billing_secure_storage')}
                </span>
                <Button
                  loading={billing.actionLoading === 'admin-update'}
                  onClick={billing.handleAdminUpdate}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
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
              <section className="p-8 backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 shadow-2xl rounded-2xl overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl shadow-inner">
                    <AlertCircle className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {t('billing_admin_transactions')}
                    </h3>
                    <p className="text-xxs font-bold text-amber-400 uppercase tracking-[0.2em]">
                      Manual Verification Required
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.03]">
                        {['User', 'Method', 'TX ID', 'Amount', 'Plan', 'Actions'].map(h => (
                          <th
                            key={h}
                            className="px-6 py-4 text-xxs font-bold uppercase tracking-wider text-white/50"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {billing.adminTransactions.length > 0 ? (
                        billing.adminTransactions.map(tx => (
                          <tr
                            key={tx.id}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-6 py-4 text-xs font-bold text-white">{tx.userEmail}</td>
                            <td className="px-6 py-4 text-xs font-black uppercase text-amber-400">
                              {tx.method}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-white/70">{tx.transactionId}</td>
                            <td className="px-6 py-4 text-xs font-bold text-white">
                              {tx.amount} {tx.currency}
                            </td>
                            <td className="px-6 py-4 text-xs uppercase text-white/60">
                              {tx.planId?.split('_')[1]}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  loading={billing.actionLoading === `verify-${tx.id}`}
                                  onClick={() => billing.handleVerifyTransaction(tx.id)}
                                  className="bg-emerald-600 text-white hover:bg-emerald-500 text-xxs font-black uppercase tracking-widest rounded-lg"
                                >
                                  {t('billing_admin_verify')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => billing.setSelectedTransactionId(tx.id)}
                                  className="text-xxs font-black uppercase tracking-widest rounded-lg"
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
                            className="px-6 py-10 text-center text-xs text-white/40 font-semibold uppercase tracking-widest italic"
                          >
                            {t('billing_admin_no_pending')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="p-8 backdrop-blur-xl bg-slate-900/60 border border-purple-500/20 shadow-2xl rounded-2xl overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-purple-500/15 border border-purple-500/30 rounded-xl shadow-inner">
                    <Ticket className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {t('billing_admin_vouchers')}
                    </h3>
                    <p className="text-xxs font-bold text-purple-400 uppercase tracking-[0.2em]">
                      Batch Generation Unit
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="text-xxs font-bold text-white/60 uppercase tracking-widest mb-1.5 block ml-1">
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
                      className="font-bold uppercase tracking-wider bg-slate-900 border-white/10 text-white rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xxs font-bold text-white/60 uppercase tracking-widest mb-1.5 block ml-1">
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
                      className="bg-white/[0.03] border-white/10 text-white rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xxs font-bold text-white/60 uppercase tracking-widest mb-1.5 block ml-1">
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
                      className="bg-white/[0.03] border-white/10 text-white rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  loading={billing.actionLoading === 'generate-vouchers'}
                  onClick={billing.handleGenerateVouchers}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl shadow-lg shadow-purple-950/40 font-bold uppercase tracking-wider text-xs"
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
