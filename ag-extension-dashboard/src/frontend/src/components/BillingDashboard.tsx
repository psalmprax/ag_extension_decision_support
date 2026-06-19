import React from 'react';
import {
    CreditCard,
    CheckCircle,
    Zap,
    Shield,
    ArrowRight,
    ExternalLink,
    AlertCircle,
    Clock,
    TrendingUp,
    Download,
    FileText,
    Receipt,
    Plus,
    Trash2,
    Lock,
    Settings,
    Globe,
    CreditCard as CardIcon,
    Smartphone,
    Ticket
} from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { motion } from 'framer-motion';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useLanguage } from '@/lib/LanguageContext';
import { PaymentAnalyticsDashboard } from './PaymentAnalyticsDashboard';
import { UsageQuota } from './UsageQuota';
import { ConfirmModal } from './ConfirmModal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { Dialog, DialogTitle, DialogContent, DialogActions } from './ui/Dialog';
import { Textarea } from './ui/Textarea';

export const BillingDashboard: React.FC = () => {
    const { isModern, headingClass, radiusClass, btnClass } = useThemeClasses();
    const { t } = useLanguage();
    const billing = useBillingActions();

    if (billing.loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]" role="status" aria-label="Loading billing data">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <CreditCard className="w-8 h-8 text-primary-500 animate-pulse" />
                    </div>
                </div>
                <p className="mt-6 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest text-xxs animate-pulse">{t('billing_syncing')}</p>
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
                                ? "Action Required: Stripe or PayPal API keys are missing. Please update your credentials in the Admin Vault section below to enable card and PayPal payments."
                                : "Note: We are currently updating our payment gateways. Some card and PayPal features may be temporarily unavailable. Please use Vouchers or Mobile Money in the meantime."
                            }
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Success/Cancel Messages */}
            {billing.success && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    className={`mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${radiusClass} flex items-center gap-3`}>
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-800 dark:text-green-200 font-medium">{t('subscription_success') || 'Subscription successful! Thank you for subscribing.'}</span>
                </motion.div>
            )}
            {billing.canceled && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    className={`mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 ${radiusClass} flex items-center gap-3`}>
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-yellow-800 dark:text-yellow-200 font-medium">{t('subscription_canceled') || 'Subscription was canceled. You can try again anytime.'}</span>
                </motion.div>
            )}

            <header className="mb-16 relative overflow-hidden">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative z-10">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-4">
                        <span className="w-12 h-1 text-primary-500 bg-primary-500 rounded-full inline-block"></span>
                        <span className="text-xxs font-black uppercase tracking-[0.3em] text-primary-500">{t('billing_account_control')}</span>
                    </motion.div>
                    <h1 className={`text-4xl font-black tracking-tighter mb-4 leading-none ${headingClass}`}>
                        {isModern ? 'Capital Utilization' : 'Billing & Subscriptions'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xl font-medium max-w-2xl leading-relaxed">{t('billing_subtitle')}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
                {/* Left Column: Current Plan & Controls */}
                <div className="xl:col-span-4 space-y-12 h-full">
                    {billing.subscription ? (
                        <motion.section aria-labelledby="subscription-status-title" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="relative card p-8 group bg-gray-900 border-none shadow-2xl overflow-hidden min-h-[480px] flex flex-col justify-between"
                            style={{ borderRadius: 'var(--radius-card)' }}>
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <motion.div animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    className="absolute -top-1/4 -right-1/4 w-full h-full bg-primary-500/20 rounded-full blur-[100px]" />
                                <motion.div animate={{ x: [0, -80, 0], y: [0, -60, 0], scale: [1, 1.1, 1] }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                    className="absolute -bottom-1/4 -left-1/4 w-full h-full bg-indigo-500/20 rounded-full blur-[80px]" />
                                <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" />
                                <div className="absolute inset-0 border border-white/10 rounded-[2rem] m-2 pointer-events-none" />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className={`p-4 bg-white/10 ${radiusClass} backdrop-blur-xl border border-white/20 shadow-xl`}>
                                        <Zap className="w-8 h-8 text-primary-400 transition-transform group-hover:rotate-12 duration-500" />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xxs font-black uppercase tracking-widest text-primary-300 mb-1">{t('billing_status_label')}</span>
                                        <Badge variant="success" size="sm"><div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse mr-1" />{t('billing_status_active')}</Badge>
                                    </div>
                                </div>
                                <span id="subscription-status-title" className="text-xxs font-black uppercase tracking-widest text-white/50 mb-2 block">{t('billing_current_plan')}</span>
                                <h2 className="text-3xl font-black text-white leading-none tracking-tighter mb-4 group-hover:text-primary-400 transition-colors duration-500">{billing.subscription.plan.name}</h2>
                                <div className="flex items-center gap-3 text-white/40 font-black text-xxs uppercase tracking-widest">
                                    <Clock className="w-4 h-4 text-primary-500" />
                                    <span>{t('billing_renews_on')} {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="relative z-10 pt-8 border-t border-white/10 space-y-4">
                                <button onClick={billing.handlePortal} disabled={billing.actionLoading === 'portal'}
                                    className={`w-full h-16 bg-white text-gray-900 ${radiusClass} font-black uppercase tracking-widest text-xs hover:bg-primary-500 hover:text-white transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] disabled:opacity-50`}>
                                    {billing.actionLoading === 'portal' ? <div className="w-5 h-5 border-3 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" /> : <ExternalLink className="w-5 h-5" />}
                                    {t('billing_manage_subscription')}
                                </button>
                            </div>
                        </motion.section>
                    ) : (
                        <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className={`relative p-10 bg-gray-900 ${radiusClass} border border-white/5 shadow-2xl overflow-hidden min-h-[480px] flex flex-col justify-between`}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[100px] -translate-y-32 translate-x-32" />
                            <div className="relative z-10">
                                <div className={`p-5 bg-primary-500/10 ${radiusClass} border border-primary-500/20 w-fit mb-8 shadow-inner`}><TrendingUp className="w-10 h-10 text-primary-500" /></div>
                                <h3 className="text-3xl font-black text-white leading-tight tracking-tighter mb-6">{t('billing_promo_title')}</h3>
                                <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.15em] leading-relaxed">{t('billing_promo_desc')}</p>
                            </div>
                            <div className={`relative z-10 p-6 bg-white/5 ${radiusClass} border border-white/5 backdrop-blur-sm`}>
                                <div className="flex items-center gap-3 text-primary-400 font-black text-xxs uppercase tracking-widest mb-2"><Zap className="w-3.5 h-3.5" />{t('billing_instant_activation')}</div>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div animate={{ x: ["-100%", "400%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="w-1/4 h-full bg-primary-500 rounded-full" />
                                </div>
                            </div>
                        </motion.section>
                    )}
                    <section aria-label="Usage Intelligence"><UsageQuota /></section>
                </div>

                {/* Right Area: Plans & Invoices */}
                <div className="xl:col-span-8 space-y-12">
                    {/* Plans Grid */}
                    <section aria-label="Available subscription plans" className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                        {billing.plans.map((plan, idx) => (
                            <motion.article initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.15 }} key={plan.id}
                                className={`relative card group p-12 bg-white dark:bg-gray-900 border-none shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-700 ${billing.subscription?.plan.id === plan.id ? 'ring-2 ring-primary-500 border-primary-500 shadow-primary-500/20' : 'hover:-translate-y-3 hover:shadow-primary-500/10'}`}
                                style={{ borderRadius: 'var(--radius-card)' }}>
                                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
                                    <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary-500/5 rounded-full blur-[60px]" />
                                    <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-indigo-500/5 rounded-full blur-[60px]" />
                                </div>
                                {plan.id === 'price_pro_monthly' && (
                                    <div className={`mb-6 inline-flex px-4 py-1.5 bg-indigo-500/10 text-indigo-500 text-xxs font-black ${radiusClass} uppercase tracking-[0.2em] border border-indigo-500/20 backdrop-blur-md relative z-10 w-fit`}>
                                        <Shield className="w-3.5 h-3.5 mr-2" />{t('plan_badge_officer') || 'Recommended for Extension Officers'}
                                    </div>
                                )}
                                {plan.id === 'price_free' && (
                                    <div className={`mb-6 inline-flex px-4 py-1.5 bg-primary-500/10 text-primary-500 text-xxs font-black ${radiusClass} uppercase tracking-[0.2em] border border-primary-500/20 backdrop-blur-md relative z-10 w-fit`}>
                                        <Zap className="w-3.5 h-3.5 mr-2" />{t('plan_badge_farmer') || 'Ideal for Individual Farmers'}
                                    </div>
                                )}
                                <div>
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{plan.name}</h3>
                                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" /><p className="text-xxs font-black text-primary-500 uppercase tracking-[0.2em] italic">{t('plan_tier_operational')}</p></div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black text-gray-900 dark:text-white">${plan.price / 100}</span>
                                                <span className="text-gray-400 font-bold uppercase text-xxs tracking-widest">/{plan.interval}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6 mb-16">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-center gap-5 group/feature">
                                                <div className={`shrink-0 p-1.5 ${radiusClass} bg-primary-500/10 border border-primary-500/20 group-hover/feature:bg-primary-500 group-hover/feature:scale-110 transition-all duration-500`}>
                                                    <CheckCircle className="w-4 h-4 text-primary-500 group-hover/feature:text-white" />
                                                </div>
                                                <span className="text-xxs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 group-hover/feature:text-gray-900 dark:group-hover/feature:text-white transition-colors duration-300">{t(feature)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => billing.handleSubscribe(plan.id)}
                                    disabled={billing.subscription?.plan.id === plan.id || (billing.actionLoading !== null)}
                                    className={`relative z-10 w-full h-16 ${radiusClass} font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 flex items-center justify-center gap-3 overflow-hidden ${billing.subscription?.plan.id === plan.id ? 'bg-gray-100 dark:bg-white/5 text-white/20 cursor-default grayscale' : 'bg-primary-600 hover:bg-gray-900 dark:hover:bg-white dark:hover:text-gray-900 text-white shadow-2xl shadow-primary-500/30'}`}>
                                    {billing.subscription?.plan.id === plan.id && <div className="absolute inset-0 bg-primary-500/10 blur-[10px]" />}
                                    {billing.actionLoading === plan.id ? <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" /> :
                                        billing.subscription?.plan.id === plan.id ? <span className="flex items-center gap-2 relative z-10 text-primary-500"><Shield className="w-4 h-4" />{t('billing_status_active')}</span> :
                                            <>{t('billing_select_plan')}<ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-2 transition-transform duration-500" /></>}
                                </motion.button>
                            </motion.article>
                        ))}
                    </section>

                    {/* Payment Methods Section */}
                    <section aria-labelledby="payment-methods-title" className={`card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl ${radiusClass} group overflow-hidden relative`}>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[80px] -translate-y-32 translate-x-32" />
                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 bg-primary-500/10 ${radiusClass} shadow-inner group-hover:bg-primary-500 transition-colors duration-500`}><CardIcon className="w-6 h-6 text-primary-500 group-hover:text-white" /></div>
                                <div className="space-y-1"><h3 id="payment-methods-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_payment_intelligence')}</h3><p className="text-xxs font-black text-gray-400 uppercase tracking-[0.2em]">{t('billing_stored_protocols')}</p></div>
                            </div>
                            <Button loading={billing.actionLoading === 'add-pm'} onClick={billing.handleAddMethod} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-primary-500 dark:hover:bg-primary-500 dark:hover:text-white"><Plus className="w-4 h-4" />{t('billing_add_method')}</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            {/* Regional Mobile Money */}
                            <div className={`p-6 ${radiusClass} bg-green-500/5 border border-green-500/20 group/pm hover:border-green-500/40 transition-all duration-300 relative overflow-hidden`}>
                                <div className="absolute top-0 right-0 p-2 opacity-10"><Smartphone className="w-12 h-12 text-green-500" /></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`w-12 h-12 bg-green-500 ${radiusClass} flex items-center justify-center shadow-lg shadow-green-500/20`}><Smartphone className="w-6 h-6 text-white" /></div>
                                        <div className="space-y-0.5"><p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">M-Pesa / Airtel Money</p><div className="flex items-center gap-2"><Badge variant="success" size="sm">Regional</Badge><p className="text-xxs font-black text-gray-400 uppercase tracking-widest">{t('billing_mobile_transfer') || 'Mobile Transfer'}</p></div></div>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={() => { billing.setShowMobilePayForm(!billing.showMobilePayForm); billing.setFormMessage(null); }} className="border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white">{t('action_pay_mobile') || 'Pay'}</Button>
                                </div>
                                {billing.showMobilePayForm && (
                                    <div className="mt-4 pt-4 border-t border-green-500/20 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select value={billing.mobilePayData.method} onChange={(e) => billing.setMobilePayData({ ...billing.mobilePayData, method: e.target.value as 'mpesa' | 'airtel' | 'bank' })} options={[{ value: 'mpesa', label: 'M-Pesa' }, { value: 'airtel', label: 'Airtel Money' }, { value: 'bank', label: 'Bank Transfer' }]} />
                                            <Select value={billing.mobilePayData.planId} onChange={(e) => { const p = billing.plans.find(pl => pl.id === e.target.value); billing.setMobilePayData({ ...billing.mobilePayData, planId: e.target.value, amount: p ? (p.price / 100).toString() : '' }); }} options={[{ value: '', label: 'Select Plan' }, ...billing.plans.filter(p => p.price > 0).map(p => ({ value: p.id, label: `${p.name} ($${(p.price / 100).toFixed(2)}/mo)` }))] } />
                                        </div>
                                        <Input type="text" value={billing.mobilePayData.transactionId} onChange={(e) => billing.setMobilePayData({ ...billing.mobilePayData, transactionId: e.target.value })} placeholder="Enter M-Pesa/Airtel Transaction ID" />
                                        <div className="flex items-center justify-between">
                                            <p className="text-xxs text-gray-400">Admin will verify your payment before activation.</p>
                                            <Button loading={billing.actionLoading === 'mobile-pay'} disabled={!billing.mobilePayData.transactionId || !billing.mobilePayData.planId} onClick={billing.handleSubmitTransaction} className="bg-green-500 text-white hover:bg-green-600 font-black uppercase tracking-widest text-xxs">Submit Transaction</Button>
                                        </div>
                                        {billing.formMessage && <p className={`text-xs font-medium ${billing.formMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{billing.formMessage.text}</p>}
                                    </div>
                                )}
                            </div>
                            {/* AgriVoucher Option */}
                            <div className={`p-6 ${radiusClass} bg-indigo-500/5 border border-indigo-500/20 group/pm hover:border-indigo-500/40 transition-all duration-300 relative overflow-hidden`}>
                                <div className="absolute top-0 right-0 p-2 opacity-10"><Ticket className="w-12 h-12 text-indigo-500" /></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`w-12 h-12 bg-indigo-500 ${radiusClass} flex items-center justify-center shadow-lg shadow-indigo-500/20`}><Ticket className="w-6 h-6 text-white" /></div>
                                        <div className="space-y-0.5"><p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">{t('billing_voucher') || 'AgriVoucher'}</p><p className="text-xxs font-black text-gray-400 uppercase tracking-widest">{t('billing_voucher_desc') || 'Prepaid Service Code'}</p></div>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={() => { billing.setShowVoucherForm(!billing.showVoucherForm); billing.setFormMessage(null); }} className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white">{t('action_redeem') || 'Redeem'}</Button>
                                </div>
                                {billing.showVoucherForm && (
                                    <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-3">
                                        <Input type="text" value={billing.voucherCode} onChange={(e) => billing.setVoucherCode(e.target.value.toUpperCase())} placeholder="Enter voucher code (e.g. AGV-A1B2C3D4)" className="font-mono tracking-wider" />
                                        <div className="flex items-center justify-between">
                                            <p className="text-xxs text-gray-400">Instantly activates your subscription.</p>
                                            <Button loading={billing.actionLoading === 'voucher'} disabled={!billing.voucherCode.trim()} onClick={billing.handleRedeemVoucher} className="bg-indigo-500 text-white hover:bg-indigo-600 font-black uppercase tracking-widest text-xxs">Activate Voucher</Button>
                                        </div>
                                        {billing.formMessage && <p className={`text-xs font-medium ${billing.formMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{billing.formMessage.text}</p>}
                                    </div>
                                )}
                            </div>
                            {billing.paymentMethods.length > 0 ? billing.paymentMethods.map((pm) => (
                                <div key={pm.id} className={`p-6 ${radiusClass} bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between group/pm hover:border-primary-500/30 transition-all duration-300`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-8 bg-gray-900 ${radiusClass} flex items-center justify-center text-[8px] font-black text-white uppercase tracking-tighter`}>{pm.card?.brand || 'Card'}</div>
                                        <div className="space-y-1"><p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">•••• •••• •••• {pm.card?.last4}</p><p className="text-xxs font-black text-gray-400 uppercase tracking-widest">{t('billing_expires').replace('{date}', `${pm.card?.exp_month}/${pm.card?.exp_year}`)}</p></div>
                                    </div>
                                    <button onClick={() => billing.handleDeleteMethod(pm.id)} disabled={billing.actionLoading === `delete-${pm.id}`} className="p-2 text-gray-400 hover:text-error-500 transition-colors opacity-0 group-hover/pm:opacity-100 disabled:opacity-50">
                                        {billing.actionLoading === `delete-${pm.id}` ? <div className="w-4 h-4 border-2 border-error-500/20 border-t-error-500 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            )) : (
                                <div className={`col-span-2 p-10 border-2 border-dashed border-gray-100 dark:border-white/5 ${radiusClass} flex flex-col items-center justify-center gap-4 opacity-40`}><Lock className="w-8 h-8" /><p className="text-xxs font-black uppercase tracking-[0.2em]">{t('billing_no_secure_methods')}</p></div>
                            )}
                        </div>
                        {/* PayPal Integration */}
                        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center"><Globe className="w-5 h-5 text-indigo-500" /></div>
                                <div className="space-y-0.5"><h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_paypal_gateway')}</h4><p className="text-xxs font-black text-gray-400 uppercase tracking-widest">{t('billing_global_p2p')}</p></div>
                            </div>
                            <Button variant="secondary" loading={billing.actionLoading === 'paypal-price_pro_monthly'} onClick={() => billing.handlePayPalSubscription('price_pro_monthly')} className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white"><Globe className="w-4 h-4" />{t('billing_subscribe_paypal')}</Button>
                        </div>
                    </section>

                    {/* Admin Billing Settings */}
                    {billing.user?.role === 'admin' && (
                        <section aria-labelledby="admin-billing-title" className="card p-10 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 shadow-xl rounded-[2.5rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5"><Settings className="w-32 h-32 text-indigo-500" /></div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20"><Shield className="w-6 h-6 text-white" /></div>
                                <div className="space-y-1"><h3 id="admin-billing-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_admin_vault_title')}</h3><p className="text-xxs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">{t('billing_admin_vault_subtitle')}</p></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="space-y-4"><div><p className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('billing_stripe_secret')}</p><Input type="password" value={billing.adminKeys.stripeSecretKey} onChange={(e) => billing.setAdminKeys({ ...billing.adminKeys, stripeSecretKey: e.target.value })} placeholder="sk_test_••••••••••••••••••••••••" className="font-mono" /></div></div>
                                <div className="space-y-4"><div><p className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('billing_paypal_id')}</p><Input type="text" value={billing.adminKeys.paypalClientId} onChange={(e) => billing.setAdminKeys({ ...billing.adminKeys, paypalClientId: e.target.value })} placeholder="Client ID" className="font-mono" /></div></div>
                            </div>
                            <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-800 text-xxs font-black text-gray-400 uppercase tracking-widest">
                                <span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" />{t('billing_secure_storage')}</span>
                                <Button loading={billing.actionLoading === 'admin-update'} onClick={billing.handleAdminUpdate}>{t('billing_update_credentials')}</Button>
                            </div>
                        </section>
                    )}

                    {/* Invoices */}
                    <section aria-labelledby="invoices-title" className="card p-0 bg-white dark:bg-gray-900 border-none shadow-2xl overflow-hidden group">
                        <div className="p-10 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-500/10 rounded-2xl shadow-inner group-hover:bg-primary-500 transition-colors duration-500"><Receipt className="w-6 h-6 text-primary-500 group-hover:text-white" /></div>
                                <div className="space-y-1"><h3 id="invoices-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_legacy_transactions')}</h3><p className="text-xxs font-black text-gray-400 uppercase tracking-[0.2em]">{t('billing_transaction_archive')}</p></div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead><tr className="bg-gray-50/30 dark:bg-gray-800/20">{['billing_timeframe', 'billing_evaluation', 'billing_execution', 'billing_download'].map(h => <th key={h} className="px-10 py-6 text-xxs font-black uppercase tracking-[0.2em] text-gray-400">{t(h)}</th>)}</tr></thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {billing.invoices.length > 0 ? billing.invoices.map((invoice) => (
                                        <tr key={invoice.id} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors duration-300 group/row">
                                            <td className="px-10 py-6"><div className="flex items-center gap-3"><Clock className="w-4 h-4 text-gray-300 group-hover/row:text-primary-500" /><span className="text-sm font-bold text-gray-600 dark:text-gray-300">{new Date(invoice.created * 1000).toLocaleDateString()}</span></div></td>
                                            <td className="px-10 py-6 text-base font-black text-gray-900 dark:text-white">{(invoice.amount_paid / 100).toLocaleString('en-US', { style: 'currency', currency: invoice.currency })}</td>
                                            <td className="px-10 py-6"><Badge variant={invoice.status === 'paid' ? 'success' : 'warning'} size="sm"><div className={`w-1.5 h-1.5 rounded-full mr-1 ${invoice.status === 'paid' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500'}`} />{invoice.status === 'paid' ? t('billing_status_paid') : invoice.status}</Badge></td>
                                            <td className="px-10 py-6">{invoice.invoice_pdf ? <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary-600 hover:text-gray-900 dark:hover:text-white font-black text-xs uppercase tracking-widest transition-all group/pdf"><div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover/pdf:bg-primary-600 group-hover/pdf:text-white transition-all"><Download className="w-4 h-4" /></div>PDF</a> : <span className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('billing_unavailable')}</span>}</td>
                                        </tr>
                                    )) : <tr><td colSpan={4} className="px-10 py-20 text-center"><div className="flex flex-col items-center gap-4 opacity-30"><FileText className="w-12 h-12" /><p className="font-black uppercase tracking-[0.3em] text-xs">{t('billing_no_records')}</p></div></td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Admin Audit & Voucher Management */}
                    {billing.user?.role === 'admin' && (
                        <div className="space-y-8 mt-12 pb-20">
                            <section className="card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl shadow-inner"><AlertCircle className="w-6 h-6 text-amber-500" /></div>
                                    <div className="space-y-1"><h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_admin_transactions')}</h3><p className="text-xxs font-black text-amber-500 uppercase tracking-[0.2em]">Manual Verification Required</p></div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead><tr className="bg-gray-50/30 dark:bg-gray-800/20">{['User', 'Method', 'TX ID', 'Amount', 'Plan', 'Actions'].map(h => <th key={h} className="px-6 py-4 text-xxs font-black uppercase text-gray-400">{h}</th>)}</tr></thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {billing.adminTransactions.length > 0 ? billing.adminTransactions.map((tx) => (
                                                <tr key={tx.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-bold">{tx.userEmail}</td>
                                                    <td className="px-6 py-4 text-xs font-black uppercase text-amber-600">{tx.method}</td>
                                                    <td className="px-6 py-4 text-xs font-mono">{tx.transactionId}</td>
                                                    <td className="px-6 py-4 text-xs font-black">{tx.amount} {tx.currency}</td>
                                                    <td className="px-6 py-4 text-xs uppercase">{tx.planId?.split('_')[1]}</td>
                                                    <td className="px-6 py-4"><div className="flex gap-2">
                                                        <Button size="sm" loading={billing.actionLoading === `verify-${tx.id}`} onClick={() => billing.handleVerifyTransaction(tx.id)} className="bg-green-500 text-white hover:bg-green-600 text-xxs font-black uppercase tracking-widest">{t('billing_admin_verify')}</Button>
                                                        <Button size="sm" variant="danger" onClick={() => billing.setSelectedTransactionId(tx.id)} className="text-xxs font-black uppercase tracking-widest">{t('billing_admin_reject')}</Button>
                                                    </div></td>
                                                </tr>
                                            )) : <tr><td colSpan={6} className="px-6 py-10 text-center text-xs text-gray-400 font-bold uppercase tracking-widest italic">{t('billing_admin_no_pending')}</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                            <section className="card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 bg-purple-500/10 rounded-2xl shadow-inner"><Ticket className="w-6 h-6 text-purple-500" /></div>
                                    <div className="space-y-1"><h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_admin_vouchers')}</h3><p className="text-xxs font-black text-purple-500 uppercase tracking-[0.2em]">Batch Generation Unit</p></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div><label className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Plan</label><Select value={billing.voucherBatch.planId} onChange={(e) => billing.setVoucherBatch({ ...billing.voucherBatch, planId: e.target.value })} options={[{ value: 'price_pro_monthly', label: 'PRO (Monthly)' }, { value: 'price_pro_yearly', label: 'PRO (Yearly)' }, { value: 'price_enterprise_monthly', label: 'ENTERPRISE (Monthly)' }]} className="font-black uppercase tracking-widest" /></div>
                                    <div><label className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">{t('billing_admin_batch_count')}</label><Input type="number" value={billing.voucherBatch.count} onChange={(e) => billing.setVoucherBatch({ ...billing.voucherBatch, count: parseInt(e.target.value) })} /></div>
                                    <div><label className="text-xxs font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">{t('billing_admin_expiry_days')}</label><Input type="number" value={billing.voucherBatch.expiresInDays} onChange={(e) => billing.setVoucherBatch({ ...billing.voucherBatch, expiresInDays: parseInt(e.target.value) })} /></div>
                                </div>
                                <Button loading={billing.actionLoading === 'generate-vouchers'} onClick={billing.handleGenerateVouchers} className="w-full py-4 bg-purple-500 text-white rounded-2xl hover:bg-purple-600 shadow-lg shadow-purple-500/20 font-black uppercase tracking-widest text-xs">{t('billing_admin_generate_vouchers')}</Button>
                            </section>
                        </div>
                    )}

                    {/* Rejection Modal */}
                    <Dialog open={!!billing.selectedTransactionId} onClose={() => billing.setSelectedTransactionId(null)} size="md">
                        <DialogContent>
                            <div className="flex items-center gap-4 mb-6"><div className="p-3 bg-red-500/10 rounded-2xl shadow-inner"><Trash2 className="w-6 h-6 text-red-500" /></div><DialogTitle className="text-xl font-black uppercase tracking-tighter">Reject Transaction</DialogTitle></div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">{t('billing_admin_pending_reason')}</p>
                            <Textarea value={billing.rejectReason} onChange={(e) => billing.setRejectReason(e.target.value)} placeholder="Enter reason for rejection..." className="mb-6" />
                        </DialogContent>
                        <DialogActions>
                            <Button variant="ghost" onClick={() => billing.setSelectedTransactionId(null)}>{t('common_cancel')}</Button>
                            <Button variant="danger" loading={billing.actionLoading?.startsWith('reject-')} onClick={billing.handleRejectTransaction}>{t('billing_admin_reject')}</Button>
                        </DialogActions>
                    </Dialog>
                </div>
            </div>
            {billing.confirmModal && (
                <ConfirmModal isOpen={!!billing.confirmModal} onClose={() => billing.setConfirmModal(null)} onConfirm={billing.confirmModal.onConfirm} title={billing.confirmModal.title} message={billing.confirmModal.message} variant={billing.confirmModal.variant} confirmText={billing.confirmModal.confirmText} />
            )}
        </div>
    );
};

export default BillingDashboard;
