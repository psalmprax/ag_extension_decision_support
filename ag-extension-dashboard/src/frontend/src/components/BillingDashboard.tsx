import React, { useState } from 'react';
import {
  CreditCard,
  AlertCircle,
  Settings,
  Shield,
  Ticket,
  Sparkles,
  Activity,
  Receipt,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Radio,
} from 'lucide-react';
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
import { PlanCard } from './billing/PlanCard';
import { PaymentMethods } from './billing/PaymentMethods';
import { Invoices } from './billing/Invoices';
import { AccessAndCostMatrix } from './billing/AccessAndCostMatrix';
import { LiquidToggleSwitch } from './canvasui/LiquidToggleSwitch';
import { triggerHaptic } from '@/lib/haptics';

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
        className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Settings className="w-32 h-32 text-indigo-400" />
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-950/40">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3
              id="admin-billing-title"
              className="text-xl font-bold tracking-tight text-white"
            >
              {t('billing_admin_vault_title') || 'Payment Gateway Credentials Vault'}
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              {t('billing_admin_vault_subtitle') || 'Encrypted Server-Side API Secrets'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <p className="text-xxs font-bold text-white/60 uppercase tracking-widest ml-1">
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
              className="font-mono bg-white/[0.03] border-white/10 text-white rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xxs font-bold text-white/60 uppercase tracking-widest ml-1">
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
              className="font-mono bg-white/[0.03] border-white/10 text-white rounded-xl"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-6 border-t border-white/10 text-xxs font-bold text-white/50 uppercase tracking-widest">
          <span className="flex items-center gap-2 text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
            {t('billing_secure_storage') || 'Zero-Trust Secure Credential Vault'}
          </span>
          <button
            onClick={() => {
              triggerHaptic('medium');
              billing.handleAdminUpdate();
            }}
            disabled={billing.actionLoading === 'admin-update'}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-950/40 transition-all flex items-center gap-2"
          >
            {t('billing_update_credentials') || 'Save Credentials'}
          </button>
        </div>
      </section>

      {/* Admin Mobile Money Verification Queue */}
      <section className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-950/40">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">
              {t('billing_admin_transactions') || 'Pending Mobile Money Queue'}
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              Manual USSD / Till Verification
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/10">
                {['User', 'Method', 'TX ID', 'Amount', 'Plan', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xxs font-bold uppercase tracking-wider text-white/60"
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
                    <td className="px-6 py-4 text-xs font-mono text-white/80">{tx.transactionId}</td>
                    <td className="px-6 py-4 text-xs font-bold text-white">
                      {tx.amount} {tx.currency}
                    </td>
                    <td className="px-6 py-4 text-xs uppercase text-white/60 font-bold">
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
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xxs font-bold rounded-lg shadow-sm"
                        >
                          {t('billing_admin_verify') || 'Verify'}
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic('light');
                            billing.setSelectedTransactionId(tx.id);
                          }}
                          className="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white text-xxs font-bold rounded-lg shadow-sm"
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
                    className="px-6 py-12 text-center text-xs text-white/40 font-semibold uppercase tracking-widest italic"
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
      <section className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-950/40">
            <Ticket className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">
              {t('billing_admin_vouchers') || 'AgriVoucher Minting Engine'}
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              Batch Generation for Cooperatives & NGOs
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="text-xxs font-bold text-white/60 uppercase tracking-widest mb-1.5 block ml-1">
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
              className="font-bold uppercase tracking-wider bg-slate-900 border-white/10 text-white rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="text-xxs font-bold text-white/60 uppercase tracking-widest mb-1.5 block ml-1">
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
              className="bg-white/[0.03] border-white/10 text-white rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="text-xxs font-bold text-white/60 uppercase tracking-widest mb-1.5 block ml-1">
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
              className="bg-white/[0.03] border-white/10 text-white rounded-xl text-xs"
            />
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic('medium');
            billing.handleGenerateVouchers();
          }}
          disabled={billing.actionLoading === 'generate-vouchers'}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-950/40 transition-all flex items-center justify-center gap-2"
        >
          {t('billing_admin_generate_vouchers') || 'Mint Batch Vouchers'}
        </button>
      </section>
    </motion.div>
  );
};

interface BillingHeaderProps {
  currentPlanName: string;
  isProActive: boolean;
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
  isProActive,
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
    <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Billing & Subscriptions</h1>
              <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                Commerce Radar
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              {t('billing_subtitle') || 'Manage individual farmer quotas, cooperative multi-county extension officer pools, and automated billing methods.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
          {/* Telemetry Stat Chips matching VisitsPage */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/80 font-mono whitespace-nowrap">
              Tier: <strong className="text-white">{currentPlanName}</strong>
            </span>
            <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono whitespace-nowrap">
              Status: <strong>{isProActive ? 'Active' : 'Starter'}</strong>
            </span>
            <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-mono whitespace-nowrap">
              Billing: <strong>{isAnnual ? 'Annual (-20%)' : 'Monthly'}</strong>
            </span>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              void onPortal();
            }}
            disabled={actionLoading === 'portal'}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {actionLoading === 'portal' ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            <span>Customer Portal</span>
          </button>
        </div>
      </div>

      {/* Status Filter / Navigation Tabs matching VisitsPage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-white/5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'plans', label: 'Plans & Pricing', icon: Sparkles },
            { id: 'usage', label: 'Quota & Telemetry', icon: Activity },
            { id: 'payments', label: 'Payment Rails', icon: CreditCard },
            { id: 'invoices', label: 'Invoices & Receipts', icon: Receipt },
            ...(isAdmin ? [{ id: 'admin', label: 'Admin Vault', icon: Shield }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id as 'plans' | 'usage' | 'payments' | 'invoices' | 'admin');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                  : 'bg-white/[0.02] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <div className="hidden sm:block">
            <LiquidToggleSwitch compact={true} />
          </div>
          <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAnnual(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                !isAnnual ? 'bg-emerald-600 text-white shadow-sm' : 'text-white/60 hover:text-white'
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
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                isAnnual ? 'bg-emerald-600 text-white shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              Annual (-20%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BillingDashboard: React.FC = () => {
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
          className="p-5 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex items-start gap-4 shadow-xl backdrop-blur-xl"
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
          className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center gap-3 shadow-lg"
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
          className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl flex items-center gap-3 shadow-lg"
        >
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 font-bold text-xs">
            {t('subscription_canceled') || 'Checkout session canceled. You can upgrade anytime.'}
          </span>
        </motion.div>
      )}

      {/* ── Top Bento Banner & Quick Actions (Matching VisitsPage) ── */}
      <BillingHeader
        currentPlanName={currentPlanName}
        isProActive={isProActive}
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
        className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Current Plan */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xxs font-black uppercase tracking-widest text-white/50 block mb-0.5">
                  {t('billing_current_plan') || 'Current Plan'}
                </span>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {currentPlanName}
                </h2>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {isProActive ? 'ACTIVE' : 'STARTER'}
            </span>
          </div>

          {/* Card 2: Renewal Timeline */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xxs font-black uppercase tracking-widest text-white/50 block mb-0.5">
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
              {isAnnual ? 'Annual (-20%)' : 'Monthly Auto-Renew'}
            </span>
          </div>

          {/* Card 3: Instant Customer Portal Action */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xxs font-black uppercase tracking-widest text-white/50 block">
                Stripe Customer Portal
              </span>
              <span className="text-xs text-white/70 font-medium">Manage payment methods & invoices</span>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                void billing.handlePortal();
              }}
              disabled={billing.actionLoading === 'portal'}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/10 text-white border border-white/10 font-bold text-xxs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
            >
              {billing.actionLoading === 'portal' ? (
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Portal</span>
            </button>
          </div>
        </div>
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
          <AdminVaultSection billing={billing} />
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
    </main>
  );
};

export default BillingDashboard;
