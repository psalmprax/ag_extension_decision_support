import React, { useState } from 'react';
import {
  CreditCard,
  AlertCircle,
  Settings,
  Shield,
  Layers,
  Activity,
  Receipt,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useLanguage } from '@/lib/LanguageContext';
import { UsageQuota } from './UsageQuota';
import { ConfirmModal } from './ConfirmModal';
import { BaseModal } from './BaseModal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { PlanCard } from './billing/PlanCard';
import { PaymentMethods } from './billing/PaymentMethods';
import { Invoices } from './billing/Invoices';
import { AccessAndCostMatrix } from './billing/AccessAndCostMatrix';
import { ChurnReasons } from './billing/ChurnReasons';
import { CancelSubscriptionModal } from './billing/CancelSubscriptionModal';
import { triggerHaptic } from '@/lib/haptics';
import { ManualPlanGrants } from './billing/ManualPlanGrants';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIMARY_BUTTON, tabButtonClass } from '@/components/ui/controlStyles';

interface AdminVaultProps {
  billing: ReturnType<typeof useBillingActions>;
}

const AdminVaultSection: React.FC<AdminVaultProps> = ({ billing }) => {
  const { t } = useLanguage();

  return (
    <motion.div
      key="tab-admin"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Admin Vault Settings */}
      <section
        aria-labelledby="admin-billing-title"
        className="backdrop-blur-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Settings className="w-32 h-32 text-slate-700 dark:text-slate-400" />
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-700 dark:text-slate-400" />
          </div>
          <div>
            <h3
              id="admin-billing-title"
              className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              {t('billing_admin_vault_title') || 'Payment Gateway Credentials Vault'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
              {t('billing_admin_vault_subtitle') || 'Encrypted Server-Side API Secrets'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label
              htmlFor="stripe-secret"
              className="text-xxs font-bold text-slate-600 dark:text-white/60 block ml-1"
            >
              {t('ui_billing_dashboard_stripe_secret_key_sk_live')}
            </label>
            <Input
              id="stripe-secret"
              type="password"
              placeholder="sk_live_••••••••••••••••••••••••"
              value={billing.adminKeys.stripeSecretKey}
              onChange={e =>
                billing.setAdminKeys({
                  ...billing.adminKeys,
                  stripeSecretKey: e.target.value,
                })
              }
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="stripe-webhook"
              className="text-xxs font-bold text-slate-600 dark:text-white/60 block ml-1"
            >
              {t('ui_billing_dashboard_stripe_webhook_secret_whsec')}
            </label>
            <Input
              id="stripe-webhook"
              type="password"
              placeholder="whsec_••••••••••••••••••••••••"
              value={billing.adminKeys.stripeWebhookSecret}
              onChange={e =>
                billing.setAdminKeys({
                  ...billing.adminKeys,
                  stripeWebhookSecret: e.target.value,
                })
              }
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="paypal-client"
              className="text-xxs font-bold text-slate-600 dark:text-white/60 block ml-1"
            >
              {t('ui_billing_dashboard_paypal_client_id')}
            </label>
            <Input
              id="paypal-client"
              placeholder="PayPal REST Client ID"
              value={billing.adminKeys.paypalClientId}
              onChange={e =>
                billing.setAdminKeys({
                  ...billing.adminKeys,
                  paypalClientId: e.target.value,
                })
              }
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="paypal-secret"
              className="text-xxs font-bold text-slate-600 dark:text-white/60 block ml-1"
            >
              {t('ui_billing_dashboard_paypal_secret_key')}
            </label>
            <Input
              id="paypal-secret"
              type="password"
              placeholder="PayPal REST Secret"
              value={billing.adminKeys.paypalSecret}
              onChange={e =>
                billing.setAdminKeys({
                  ...billing.adminKeys,
                  paypalSecret: e.target.value,
                })
              }
              className="font-mono text-xs"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => {
              triggerHaptic('medium');
              billing.handleAdminUpdate();
            }}
            disabled={billing.actionLoading === 'admin-update'}
            className="w-full md:w-auto font-bold px-8 shadow-lg shadow-slate-950/40"
          >
            {billing.actionLoading === 'admin-update'
              ? 'Saving Credentials...'
              : t('billing_admin_save_vault') || 'Encrypt & save credentials'}
          </Button>
        </div>
      </section>

      <ManualPlanGrants billing={billing} />
    </motion.div>
  );
};

interface BillingHeaderProps {
  currentPlanName: string;
  isAnnual: boolean;
  setIsAnnual: (annual: boolean) => void;
  onPortal: () => void;
  actionLoading: string | null;
  activeTab: string;
  setActiveTab: (tab: 'plans' | 'usage' | 'payments' | 'invoices' | 'admin') => void;
  isAdmin: boolean;
}

const BillingHeader: React.FC<BillingHeaderProps> = ({
  currentPlanName,
  isAnnual,
  setIsAnnual,
  onPortal,
  actionLoading,
  activeTab,
  setActiveTab,
  isAdmin,
}) => {
  const { t } = useLanguage();

  return (
    <PageHeader
        title={t('ui_billing_dashboard_billing_subscriptions')}
        description={t('billing_subtitle') || 'Your plan, usage, payment methods and invoices.'}
        meta={t('billing_summary', {
          plan: currentPlanName,
          cycle: isAnnual ? t('billing_cycle_annual', { defaultValue: 'annually' }) : t('billing_cycle_monthly', { defaultValue: 'monthly' }),
          defaultValue: 'Plan: {plan}, billed {cycle}',
        })}
        actions={
          <button
            onClick={() => {
              triggerHaptic('light');
              void onPortal();
            }}
            disabled={actionLoading === 'portal'}
            className={PRIMARY_BUTTON}
          >
            {actionLoading === 'portal' ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{t('ui_billing_dashboard_customer_portal')}</span>
          </button>
        }
      >
      {/* Status Filter / Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'plans', label: t('billing_tab_plans', { defaultValue: 'Plans & pricing' }), icon: Layers },
            { id: 'usage', label: t('billing_tab_usage', { defaultValue: 'Usage' }), icon: Activity },
            { id: 'payments', label: t('billing_tab_payments', { defaultValue: 'Payment methods' }), icon: CreditCard },
            { id: 'invoices', label: t('billing_tab_invoices', { defaultValue: 'Invoices & receipts' }), icon: Receipt },
            ...(isAdmin ? [{ id: 'admin', label: t('billing_tab_admin', { defaultValue: 'Payment keys' }), icon: Shield }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id as 'plans' | 'usage' | 'payments' | 'invoices' | 'admin');
              }}
              aria-pressed={activeTab === tab.id}
              className={tabButtonClass(activeTab === tab.id)}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAnnual(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                !isAnnual ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('ui_billing_dashboard_monthly')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAnnual(true);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                isAnnual ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('ui_billing_dashboard_annual_20')}
            </button>
          </div>
        </div>
      </div>
      </PageHeader>
  );
};

export const BillingDashboard: React.FC = () => {
  const { t } = useLanguage();
  const billing = useBillingActions();
  const [isAnnual, setIsAnnual] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans' | 'usage' | 'payments' | 'invoices' | 'admin'>('plans');
  const [showCancelModal, setShowCancelModal] = useState(false);

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
            <CreditCard className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
          </div>
        </div>
        <p className="mt-4 text-slate-400 font-medium text-xs">
          {t('billing_syncing') || 'Synchronizing Billing Rails...'}
        </p>
      </div>
    );
  }

  const currentPlanName = billing.subscription?.plan?.name || 'Free Starter';
  const isProActive = Boolean(
    billing.subscription?.plan?.id?.includes('pro') ||
    billing.subscription?.plan?.name?.toLowerCase().includes('pro')
  );

  return (
    <main id="billing-main" className="max-w-7xl mx-auto space-y-6">
      {/* Configuration Alert Banner */}
      {(billing.configErrors.stripe || billing.configErrors.paypal) && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl flex items-start gap-4 shadow-xl backdrop-blur-xl"
        >
          <AlertCircle className="w-6 h-6 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-amber-700 dark:text-amber-400 font-black text-xs mb-1">
              {t('billing_configuration_alert') || 'PAYMENT GATEWAY CONFIGURATION REQUIRED'}
            </h3>
            <p className="text-amber-300/90 font-medium text-xs leading-relaxed">
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
          className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-xl flex items-center gap-3 shadow-lg"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-xs">
            {t('subscription_success') || 'Subscription successfully updated! Thank you for empowering African agriculture.'}
          </span>
        </motion.div>
      )}
      {billing.canceled && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center gap-3 shadow-lg"
        >
          <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300 font-bold text-xs">
            {t('subscription_canceled') || 'Checkout session canceled. You can upgrade anytime.'}
          </span>
        </motion.div>
      )}

      {/* ── Top Bento Banner & Quick Actions (Matching VisitsPage) ── */}
      <BillingHeader
        currentPlanName={currentPlanName}
        isAnnual={isAnnual}
        setIsAnnual={setIsAnnual}
        onPortal={() => {
          void billing.handlePortal();
        }}
        actionLoading={billing.actionLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={billing.user?.role === 'admin'}
      />

      {/* ── Active Membership Pod Ribbon (Unit Test Target) ── */}
      <section
        aria-label="Subscription Overview"
        className="backdrop-blur-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Current Plan */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xxs font-black text-slate-500 dark:text-white/50 block mb-0.5">
                  {t('billing_current_plan') || 'Current plan'}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                  {currentPlanName}
                </h2>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-xxs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              {isProActive ? t('billing_status_active_label', { defaultValue: 'Active' }) : t('billing_status_free_label', { defaultValue: 'Free' })}
            </span>
          </div>

          {/* Card 2: Renewal Timeline */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-slate-500/10 border border-slate-500/20 rounded-xl text-slate-700 dark:text-slate-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xxs font-black text-slate-500 dark:text-white/50 block mb-0.5">
                  {t('billing_renews_on') || 'Billing Cycle'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {billing.subscription?.currentPeriodEnd
                    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()
                    : 'Lifetime Free Starter'}
                </span>
              </div>
            </div>
            <span className="text-xxs text-emerald-700 dark:text-emerald-400 font-mono font-bold">
              {isAnnual ? 'Annual (-20%)' : 'Monthly Auto-Renew'}
            </span>
          </div>

          {/* Card 3: Instant Customer Portal Action */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xxs font-black text-slate-500 dark:text-white/50 block">
                {t('ui_billing_dashboard_stripe_customer_portal')}
              </span>
              <span className="text-xs text-slate-600 dark:text-white/70 font-medium">{t('ui_billing_dashboard_manage_payment_methods_invoices')}</span>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                void billing.handlePortal();
              }}
              disabled={billing.actionLoading === 'portal'}
              className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 font-bold text-xxs transition-all flex items-center gap-1.5 shrink-0"
            >
              {billing.actionLoading === 'portal' ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-300 dark:border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              )}
              <span>{t('ui_billing_dashboard_portal')}</span>
            </button>
          </div>
        </div>

        {billing.subscription && !billing.subscription.cancelAtPeriodEnd && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xxs text-slate-500 dark:text-white/50">
              {t('ui_billing_dashboard_cancelling_keeps_your_plan_active_un')}
            </p>
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowCancelModal(true);
              }}
              className="text-xxs font-bold text-rose-700 dark:text-rose-300 hover:text-rose-200 transition-colors self-start sm:self-auto"
            >
              {t('ui_billing_dashboard_cancel_subscription')}
            </button>
          </div>
        )}
        {billing.subscription?.cancelAtPeriodEnd && (
          <p className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 text-xxs text-amber-700 dark:text-amber-300">
            {t('ui_billing_dashboard_this_subscription_is_set_to_end_at_t')}
          </p>
        )}
      </section>

      {/* ── Tab Content Views ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'plans' && (
          <motion.div
            key="tab-plans"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <section
              aria-label="Available subscription plans"
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
            >
              {billing.plans.map((plan, idx) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  index={idx}
                  isCurrentPlan={billing.subscription?.plan?.id === plan.id}
                  isAnnual={isAnnual}
                  onSelect={billing.handleSubscribe}
                  actionLoading={billing.actionLoading}
                />
              ))}
            </section>

            <section aria-label="Feature Access and Cost Matrix">
              <AccessAndCostMatrix onSelectPlan={billing.handleSubscribe} />
            </section>
          </motion.div>
        )}

        {activeTab === 'usage' && (
          <motion.div
            key="tab-usage"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <section aria-label="Usage Intelligence">
              <UsageQuota />
            </section>
          </motion.div>
        )}

        {activeTab === 'payments' && (
          <motion.div
            key="tab-payments"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
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
          </motion.div>
        )}

        {activeTab === 'invoices' && (
          <motion.div
            key="tab-invoices"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <Invoices invoices={billing.invoices} />
          </motion.div>
        )}

        {activeTab === 'admin' && billing.user?.role === 'admin' && (
          <div className="space-y-6">
            <ChurnReasons />
            <AdminVaultSection billing={billing} />
          </div>
        )}
      </AnimatePresence>

      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        loading={billing.actionLoading === 'cancel'}
        onConfirm={async (reason, comment) => {
          const done = await billing.handleCancelSubscription(reason, comment);
          if (done) setShowCancelModal(false);
          return done;
        }}
      />

      {/* ── Rejection Modal ── */}
      <BaseModal
        isOpen={!!billing.selectedTransactionId}
        onClose={() => billing.setSelectedTransactionId(null)}
        title="Reject Transaction"
        subtitle="Admin Verification Action"
        icon={<AlertCircle className="w-5 h-5 text-rose-700 dark:text-rose-400" />}
        iconBg="bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400"
        footer={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                triggerHaptic('light');
                billing.setSelectedTransactionId(null);
              }}
              className="flex-1 text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              {t('common_cancel') || 'Cancel'}
            </Button>
            <Button
              variant="danger"
              loading={billing.actionLoading?.startsWith('reject-')}
              onClick={() => {
                triggerHaptic('medium');
                billing.handleRejectTransaction();
              }}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {t('billing_admin_reject') || 'Confirm Rejection'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-400 font-bold mb-3">
          {t('billing_admin_pending_reason') || 'Specify reason for rejection to notify user'}
        </p>
        <Textarea
          value={billing.rejectReason}
          onChange={e => billing.setRejectReason(e.target.value)}
          placeholder="Enter reason for rejection..."
          className="w-full bg-white dark:bg-slate-900/80 border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs"
          rows={4}
        />
      </BaseModal>

      {/* ── Plan Confirmation Modal ── */}
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
    </main>
  );
};

export default BillingDashboard;
