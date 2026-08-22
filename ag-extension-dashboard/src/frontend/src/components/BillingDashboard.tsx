import React, { useState } from 'react';
import {
  CreditCard,
  AlertCircle,
  Settings,
  Shield,
  Ticket,
  Sparkles,
  Zap,
  Activity,
  Layers,
  DollarSign,
  Receipt,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Building2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { motion, AnimatePresence } from 'framer-motion';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useLanguage } from '@/lib/LanguageContext';
import { UsageQuota } from './UsageQuota';
import { ConfirmModal } from './ConfirmModal';
import { BaseModal } from './BaseModal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { Badge } from './ui/Badge';
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
  const [activeTab, setActiveTab] = useState<'plans' | 'usage' | 'payments' | 'invoices' | 'admin'>('plans');

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

  const currentPlanName = billing.subscription?.plan?.name || 'Free Starter';
  const isProActive = billing.subscription?.plan?.id?.includes('pro') || billing.subscription?.plan?.name?.toLowerCase().includes('pro');

  return (
    <div className="max-w-[1440px] mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Configuration Alert Banner */}
      {(billing.configErrors.stripe || billing.configErrors.paypal) && (
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 bg-amber-500/10 border-2 border-amber-500/40 ${radiusClass} flex items-start gap-4 shadow-xl backdrop-blur-2xl`}
        >
          <AlertCircle className="w-6 h-6 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-amber-400 font-black uppercase tracking-widest text-xs mb-1">
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
          className={`p-4 bg-emerald-500/10 border border-emerald-500/40 ${radiusClass} flex items-center gap-3 shadow-lg`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-300 font-bold text-xs">
            {t('subscription_success') || 'Subscription successfully updated! Thank you for empowering African agriculture.'}
          </span>
        </motion.div>
      )}
      {billing.canceled && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-4 bg-amber-500/10 border border-amber-500/40 ${radiusClass} flex items-center gap-3 shadow-lg`}
        >
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 font-bold text-xs">
            {t('subscription_canceled') || 'Checkout session canceled. You can upgrade anytime.'}
          </span>
        </motion.div>
      )}

      {/* ── Top Hero Header & Telemetry Strip ── */}
      <header className="relative overflow-hidden p-8 lg:p-10 rounded-3xl bg-slate-950/95 dark:bg-slate-950/95 border border-emerald-500/30 backdrop-blur-2xl shadow-2xl">
        {/* Ambient Mesh Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xxs font-black uppercase tracking-[0.25em] text-emerald-400">
                {t('billing_account_control') || 'AG-EXTENSION TELEMETRY & SEATS'}
              </span>
            </div>
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white ${headingClass}`}>
              Billing & Subscriptions
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mt-2 leading-relaxed font-medium">
              {t('billing_subtitle') || 'Enterprise agricultural decision support. Manage individual farmer quotas, cooperative multi-county officer seats, and automated mobile money billing.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* CanvasUI Liquid Shader Switch */}
            <LiquidToggleSwitch compact={false} />

            {/* KnockKnock Monthly ↔ Annual Toggle */}
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

        {/* ── Active Membership Pod Ribbon (Required by Unit Tests) ── */}
        <div
          aria-label="Subscription Overview"
          className="mt-8 pt-8 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10"
        >
          {/* Card 1: Current Plan */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/20 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xxs font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                  {t('billing_current_plan') || 'Current Plan'}
                </span>
                <h2 className="text-xl font-black text-white leading-tight">
                  {currentPlanName}
                </h2>
              </div>
            </div>
            <Badge variant={isProActive ? 'success' : 'neutral'} size="sm">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse mr-1" />
              {isProActive ? 'ACTIVE' : 'STARTER'}
            </Badge>
          </div>

          {/* Card 2: Renewal & License Timeline */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-inner">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xxs font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                  {t('billing_renews_on') || 'Billing Cycle'}
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  {billing.subscription?.currentPeriodEnd
                    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()
                    : 'Lifetime Free Starter'}
                </span>
              </div>
            </div>
            <span className="text-xxs text-emerald-400 font-mono font-bold">
              {isAnnual ? 'Billed Annually' : 'Monthly Auto-Renew'}
            </span>
          </div>

          {/* Card 3: Instant Customer Portal Action */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between shadow-lg">
            <div className="space-y-0.5">
              <span className="text-xxs font-black uppercase tracking-widest text-slate-400 block">
                Stripe Customer Portal
              </span>
              <span className="text-xs text-slate-300 font-medium">Manage payment methods & invoices</span>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                void billing.handlePortal();
              }}
              disabled={billing.actionLoading === 'portal'}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xxs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shrink-0 active:scale-95 disabled:opacity-50"
            >
              {billing.actionLoading === 'portal' ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── KnockKnock Bento Suite Tabs Navigation ── */}
      <nav aria-label="Billing Suite Navigation" className="flex overflow-x-auto p-1.5 bg-slate-950/90 rounded-2xl border border-emerald-500/20 backdrop-blur-2xl shadow-xl gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('plans');
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'plans'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 ring-1 ring-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Plans & Pricing</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('usage');
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'usage'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 ring-1 ring-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Quota & Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('payments');
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'payments'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 ring-1 ring-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Rails</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('invoices');
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 ring-1 ring-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Invoices & Receipts</span>
        </button>

        {billing.user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('admin');
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950 ring-1 ring-indigo-400/40'
                : 'text-indigo-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Vault & Verification</span>
          </button>
        )}
      </nav>

      {/* ── Tab Content Views ── */}
      <AnimatePresence mode="wait">
        {/* TAB 1: Plans & Pricing + Cost Matrix */}
        {activeTab === 'plans' && (
          <motion.div
            key="tab-plans"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-10"
          >
            {/* Plans Grid (Unit Test Target) */}
            <section
              aria-label="Available subscription plans"
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch"
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

            {/* Feature Access & Cost Matrix */}
            <section aria-label="Feature Access and Cost Matrix">
              <AccessAndCostMatrix onSelectPlan={billing.handleSubscribe} />
            </section>
          </motion.div>
        )}

        {/* TAB 2: Quota & Live Telemetry */}
        {activeTab === 'usage' && (
          <motion.div
            key="tab-usage"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <section aria-label="Usage Intelligence">
              <UsageQuota />
            </section>
          </motion.div>
        )}

        {/* TAB 3: African FinTech, Cards & Vouchers */}
        {activeTab === 'payments' && (
          <motion.div
            key="tab-payments"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
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

        {/* TAB 4: Invoices & Receipts */}
        {activeTab === 'invoices' && (
          <motion.div
            key="tab-invoices"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <Invoices invoices={billing.invoices} />
          </motion.div>
        )}

        {/* TAB 5: Admin Cyber Vault & Verification */}
        {activeTab === 'admin' && billing.user?.role === 'admin' && (
          <motion.div
            key="tab-admin"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-10"
          >
            {/* Admin Vault Settings */}
            <section
              aria-labelledby="admin-billing-title"
              className="p-8 lg:p-10 backdrop-blur-2xl bg-slate-950/95 border border-indigo-500/30 shadow-2xl rounded-3xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Settings className="w-40 h-40 text-indigo-400" />
              </div>
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl text-indigo-400 shadow-inner">
                  <Shield className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3
                    id="admin-billing-title"
                    className="text-2xl font-black text-white uppercase tracking-tight"
                  >
                    {t('billing_admin_vault_title') || 'Payment Gateway Credentials Vault'}
                  </h3>
                  <p className="text-xxs font-black text-indigo-400 uppercase tracking-[0.2em]">
                    {t('billing_admin_vault_subtitle') || 'Encrypted Server-Side API Secrets'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <p className="text-xxs font-bold text-slate-300 uppercase tracking-widest ml-1">
                    {t('billing_stripe_secret') || 'Stripe Secret Key (sk_live / sk_test)'}
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
                    placeholder="sk_live_••••••••••••••••••••••••"
                    className="font-mono bg-slate-900/90 border-slate-800 text-white rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xxs font-bold text-slate-300 uppercase tracking-widest ml-1">
                    {t('billing_paypal_id') || 'PayPal Client ID'}
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
                    placeholder="PayPal Production Client ID"
                    className="font-mono bg-slate-900/90 border-slate-800 text-white rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-slate-800 text-xxs font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-2 text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                  {t('billing_secure_storage') || 'Zero-Trust Secure Credential Vault'}
                </span>
                <Button
                  loading={billing.actionLoading === 'admin-update'}
                  onClick={() => {
                    triggerHaptic('medium');
                    billing.handleAdminUpdate();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-950"
                >
                  {t('billing_update_credentials') || 'Save Credentials'}
                </Button>
              </div>
            </section>

            {/* Admin Mobile Money Verification Queue */}
            <section className="p-8 lg:p-10 backdrop-blur-2xl bg-slate-950/95 border border-amber-500/30 shadow-2xl rounded-3xl overflow-hidden">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    {t('billing_admin_transactions') || 'Pending Mobile Money Queue'}
                  </h3>
                  <p className="text-xxs font-bold text-amber-400 uppercase tracking-[0.2em]">
                    Manual USSD / Till Verification
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800">
                      {['User', 'Method', 'TX ID', 'Amount', 'Plan', 'Actions'].map(h => (
                        <th
                          key={h}
                          className="px-6 py-4 text-xxs font-bold uppercase tracking-wider text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {billing.adminTransactions.length > 0 ? (
                      billing.adminTransactions.map(tx => (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="px-6 py-4 text-xs font-bold text-white">{tx.userEmail}</td>
                          <td className="px-6 py-4 text-xs font-black uppercase text-amber-400">
                            {tx.method}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-300">{tx.transactionId}</td>
                          <td className="px-6 py-4 text-xs font-bold text-white">
                            {tx.amount} {tx.currency}
                          </td>
                          <td className="px-6 py-4 text-xs uppercase text-slate-400 font-bold">
                            {tx.planId?.split('_')[1]}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                loading={billing.actionLoading === `verify-${tx.id}`}
                                onClick={() => {
                                  triggerHaptic('medium');
                                  billing.handleVerifyTransaction(tx.id);
                                }}
                                className="bg-emerald-600 text-white hover:bg-emerald-500 text-xxs font-black uppercase tracking-widest rounded-lg"
                              >
                                {t('billing_admin_verify') || 'Verify'}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  triggerHaptic('light');
                                  billing.setSelectedTransactionId(tx.id);
                                }}
                                className="text-xxs font-black uppercase tracking-widest rounded-lg"
                              >
                                {t('billing_admin_reject') || 'Reject'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-xs text-slate-500 font-semibold uppercase tracking-widest italic"
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
            <section className="p-8 lg:p-10 backdrop-blur-2xl bg-slate-950/95 border border-purple-500/30 shadow-2xl rounded-3xl overflow-hidden">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3.5 bg-purple-500/15 border border-purple-500/30 rounded-2xl text-purple-400 shadow-inner">
                  <Ticket className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    {t('billing_admin_vouchers') || 'AgriVoucher Minting Engine'}
                  </h3>
                  <p className="text-xxs font-bold text-purple-400 uppercase tracking-[0.2em]">
                    Batch Generation for Cooperatives & NGOs
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="text-xxs font-bold text-slate-300 uppercase tracking-widest mb-1.5 block ml-1">
                    Target Tier
                  </label>
                  <Select
                    value={billing.voucherBatch.planId}
                    onChange={e =>
                      billing.setVoucherBatch({ ...billing.voucherBatch, planId: e.target.value })
                    }
                    options={[
                      { value: 'price_pro_monthly', label: 'PRO OFFICER (Monthly)' },
                      { value: 'price_pro_yearly', label: 'PRO OFFICER (Yearly)' },
                      { value: 'price_enterprise_monthly', label: 'ENTERPRISE COOPERATIVE' },
                    ]}
                    className="font-bold uppercase tracking-wider bg-slate-900 border-slate-800 text-white rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xxs font-bold text-slate-300 uppercase tracking-widest mb-1.5 block ml-1">
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
                    className="bg-slate-900 border-slate-800 text-white rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xxs font-bold text-slate-300 uppercase tracking-widest mb-1.5 block ml-1">
                    {t('billing_admin_expiry_days') || 'Expiry (Days)'}
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
                    className="bg-slate-900 border-slate-800 text-white rounded-xl text-xs"
                  />
                </div>
              </div>
              <Button
                loading={billing.actionLoading === 'generate-vouchers'}
                onClick={() => {
                  triggerHaptic('medium');
                  billing.handleGenerateVouchers();
                }}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-950 font-black uppercase tracking-wider text-xs"
              >
                {t('billing_admin_generate_vouchers') || 'Mint Batch Vouchers'}
              </Button>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rejection Modal ── */}
      <BaseModal
        isOpen={!!billing.selectedTransactionId}
        onClose={() => billing.setSelectedTransactionId(null)}
        title="Reject Transaction"
        subtitle="Admin Verification Action"
        icon={<AlertCircle className="w-5 h-5 text-rose-400" />}
        iconBg="bg-rose-500/15 border border-rose-500/30 text-rose-400"
        footer={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                triggerHaptic('light');
                billing.setSelectedTransactionId(null);
              }}
              className="flex-1 text-slate-300 hover:text-white"
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
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">
          {t('billing_admin_pending_reason') || 'Specify reason for rejection to notify user'}
        </p>
        <Textarea
          value={billing.rejectReason}
          onChange={e => billing.setRejectReason(e.target.value)}
          placeholder="Enter reason for rejection..."
          className="w-full bg-slate-900/80 border-slate-800 text-white rounded-xl text-xs"
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
    </div>
  );
};

export default BillingDashboard;
