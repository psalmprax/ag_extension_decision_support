import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
    AtSign,
    Globe,
    CreditCard as CardIcon
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { fetchPlans, fetchSubscription, createCheckoutSession, createPortalSession, fetchInvoices, switchSubscription, fetchPaymentMethods, addPaymentMethod, deletePaymentMethod, updateAdminConfig, createPayPalSubscription } from '@/api/billingService';
import { UsageQuota } from './UsageQuota';

interface Plan {
    id: string;
    name: string;
    price: number;
    interval: string;
    features: string[];
}

interface Subscription {
    id: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    plan: Plan;
}

interface Invoice {
    id: string;
    amount_paid: number;
    currency: string;
    status: string;
    created: number;
    invoice_pdf: string;
}

export const BillingDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [searchParams, setSearchParams] = useSearchParams();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [adminKeys, setAdminKeys] = useState({ stripeSecretKey: '', paypalClientId: '' });
    const { user } = useAppStore();

    // Get success/cancel status from URL params
    const success = searchParams.get('success') === 'true';
    const canceled = searchParams.get('canceled') === 'true';
    const mockPortal = searchParams.get('mock_portal') === 'true';

    // Clear URL params after showing message
    useEffect(() => {
        if (success || canceled) {
            // Clear the params after 3 seconds
            const timer = setTimeout(() => {
                setSearchParams({});
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [success, canceled, setSearchParams]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [plansRes, subRes, invoicesRes, pmRes] = await Promise.all([
                fetchPlans(),
                fetchSubscription(),
                fetchInvoices(),
                fetchPaymentMethods()
            ]);

            if (plansRes.success) setPlans(plansRes.data);
            if (subRes.success) setSubscription(subRes.data);
            if (invoicesRes.success) setInvoices(invoicesRes.data);
            if (pmRes.success) setPaymentMethods(pmRes.data);
        } catch (error) {
            console.error('Failed to fetch billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mockPortal) {
            alert("Stripe is currently in Test Mode. The Customer Portal is unavailable for real configuration, but you can see the redirection logic works.");
            setSearchParams(params => {
                params.delete('mock_portal');
                return params;
            });
        }
    }, [mockPortal, setSearchParams]);

    const handleSubscribe = async (priceId: string, billingCycle: 'current' | 'next' = 'current') => {
        setActionLoading(priceId);
        try {
            const response = await createCheckoutSession(priceId, billingCycle);

            if (!response.success) {
                // Handle specific error codes
                if (response.errorCode === 'ALREADY_SUBSCRIBED') {
                    const canSchedule = !response.subscription?.cancelAtPeriodEnd;
                    const message = canSchedule
                        ? `${response.message} ${t('confirm_next_cycle')}`
                        : `${response.message} ${t('confirm_reenable_renewal')}`;

                    if (confirm(message)) {
                        handleSubscribe(priceId, 'next');
                        return;
                    }
                    return;
                }

                if (response.errorCode === 'ACTIVE_SUBSCRIPTION_EXISTS') {
                    const isSamePlan = response.currentSubscription?.plan?.stripePriceId === priceId;

                    if (isSamePlan) {
                        if (confirm(t('confirm_plan_continuation'))) {
                            handleSubscribe(priceId, 'next');
                        }
                    } else {
                        // Different plan - offer switch
                        const switchNow = confirm(
                            `${response.message}\n\n` +
                            t('confirm_switch_plan')
                        );

                        if (switchNow) {
                            handleSwitch(priceId, 'current');
                        } else {
                            handleSwitch(priceId, 'next');
                        }
                    }
                    return;
                }

                alert(response.message || 'Action failed');
                return;
            }

            // Success case - redirect to checkout if URL provided
            if (response.data?.url) {
                window.location.href = response.data.url;
                return;
            }

            if (response.message) {
                alert(response.message);
                fetchData();
            }
        } catch (error: unknown) {

            console.error('Subscription failed:', error);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            alert((error as any).response?.data?.message || 'Subscription failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSwitch = async (priceId: string, billingCycle: 'current' | 'next' = 'current') => {
        setActionLoading(`switch-${priceId}`);
        try {
            const data = await switchSubscription(priceId, billingCycle);
            if (data.success) {
                alert(data.message || 'Plan switched successfully!');
                fetchData(); // Refresh data
            } else {
                alert(data.message || 'Failed to switch plan');
            }
        } catch (error: unknown) {

            console.error('Switch failed:', error);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            alert((error as any).response?.data?.message || 'Failed to switch plan. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePortal = async () => {
        setActionLoading('portal');
        try {
            const data = await createPortalSession();
            if (data.success && data.data.url) {
                window.location.href = data.data.url;
            }
        } catch (error) {
            console.error('Portal access failed:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddMethod = async () => {
        setActionLoading('add-pm');
        try {
            const response = await addPaymentMethod('card');
            if (response.success && response.data?.url) {
                // Real implementation: Redirect to Stripe Setup Session
                window.location.href = response.data.url;
            } else if (response.success) {
                alert(response.message || 'Payment method added successfully!');
                fetchData();
            }
        } catch (error) {
            console.error('Failed to add payment method:', error);
            alert('Failed to add payment method');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteMethod = async (id: string) => {
        if (!confirm(t('confirm_delete_payment_method') || 'Are you sure you want to remove this payment method?')) return;

        setActionLoading(`delete-${id}`);
        try {
            const response = await deletePaymentMethod(id);
            if (response.success) {
                alert(response.message || 'Payment method removed');
                fetchData(); // Refresh list
            }
        } catch (error) {
            console.error('Failed to delete payment method:', error);
            alert('Failed to delete payment method');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePayPalSubscription = async (planId: string) => {
        setActionLoading(`paypal-${planId}`);
        try {
            const response = await createPayPalSubscription(planId);
            if (response.success && response.data?.approvalUrl) {
                // Redirect to PayPal for approval
                window.location.href = response.data.approvalUrl;
            } else {
                alert(response.message || 'Failed to initiate PayPal subscription');
            }
        } catch (error) {
            console.error('PayPal subscription failed:', error);
            alert('Failed to create PayPal subscription. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAdminUpdate = async () => {
        if (!adminKeys.stripeSecretKey && !adminKeys.paypalClientId) {
            alert("Please enter at least one credential to update.");
            return;
        }

        setActionLoading('admin-update');
        try {
            const response = await updateAdminConfig(adminKeys);
            if (response.success) {
                alert(response.message || 'Credentials updated successfully');
                setAdminKeys({ stripeSecretKey: '', paypalClientId: '' });
            }
        } catch (error) {
            console.error('Failed to update credentials:', error);
            alert('Failed to update credentials. Ensure you have admin privileges.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]" role="status" aria-label="Loading billing data">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <CreditCard className="w-8 h-8 text-primary-500 animate-pulse" />
                    </div>
                </div>
                <p className="mt-6 text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">{t('billing_syncing')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto py-12 px-6">
            {/* Success/Cancel Messages */}
            {success && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3"
                >
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                        {t('subscription_success') || 'Subscription successful! Thank you for subscribing.'}
                    </span>
                </motion.div>
            )}
            {canceled && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-3"
                >
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                        {t('subscription_canceled') || 'Subscription was canceled. You can try again anytime.'}
                    </span>
                </motion.div>
            )}
            <header className="mb-16 relative overflow-hidden">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 mb-4"
                    >
                        <span className="w-12 h-1 text-primary-500 bg-primary-500 rounded-full inline-block"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-500">{t('billing_account_control')}</span>
                    </motion.div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-4 leading-none">
                        {t('billing_title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xl font-medium max-w-2xl leading-relaxed">
                        {t('billing_subtitle')}
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
                {/* Left Column: Current Plan & Controls (Mission Control Style) */}
                <div className="xl:col-span-4 space-y-12 h-full">
                    {subscription ? (
                        <motion.section
                            aria-labelledby="subscription-status-title"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative card p-8 group bg-gray-900 border-none shadow-2xl overflow-hidden min-h-[480px] flex flex-col justify-between rounded-[2.5rem]"
                        >
                            {/* Mesh Gradient Background */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <motion.div
                                    animate={{
                                        x: [0, 100, 0],
                                        y: [0, 50, 0],
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    className="absolute -top-1/4 -right-1/4 w-full h-full bg-primary-500/20 rounded-full blur-[100px]"
                                />
                                <motion.div
                                    animate={{
                                        x: [0, -80, 0],
                                        y: [0, -60, 0],
                                        scale: [1, 1.1, 1]
                                    }}
                                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                    className="absolute -bottom-1/4 -left-1/4 w-full h-full bg-indigo-500/20 rounded-full blur-[80px]"
                                />
                                <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" />
                                <div className="absolute inset-0 border border-white/10 rounded-[2rem] m-2 pointer-events-none" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20 shadow-xl" aria-hidden="true">
                                        <Zap className="w-8 h-8 text-primary-400 transition-transform group-hover:rotate-12 duration-500" />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-300 mb-1">{t('billing_status_label')}</span>
                                        <span className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-green-500/20">
                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                            {t('billing_status_active')}
                                        </span>
                                    </div>
                                </div>
                                <span id="subscription-status-title" className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">
                                    {t('billing_current_plan')}
                                </span>
                                <h2 className="text-3xl font-black text-white leading-none tracking-tighter mb-4 group-hover:text-primary-400 transition-colors duration-500">
                                    {subscription.plan.name}
                                </h2>
                                <div className="flex items-center gap-3 text-white/40 font-black text-[10px] uppercase tracking-widest">
                                    <Clock className="w-4 h-4 text-primary-500" aria-hidden="true" />
                                    <span>{t('billing_renews_on')} {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="relative z-10 pt-8 border-t border-white/10 space-y-4">
                                <button
                                    onClick={handlePortal}
                                    disabled={actionLoading === 'portal'}
                                    className="w-full h-16 bg-white text-gray-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-500 hover:text-white transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] disabled:opacity-50"
                                >
                                    {actionLoading === 'portal' ? (
                                        <div className="w-5 h-5 border-3 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
                                    ) : (
                                        <ExternalLink className="w-5 h-5" />
                                    )}
                                    {t('billing_manage_subscription')}
                                </button>
                            </div>
                        </motion.section>
                    ) : (
                        <motion.section
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative p-10 bg-gray-900 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden min-h-[480px] flex flex-col justify-between"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[100px] -translate-y-32 translate-x-32" />
                            <div className="relative z-10">
                                <div className="p-5 bg-primary-500/10 rounded-2xl border border-primary-500/20 w-fit mb-8 shadow-inner">
                                    <TrendingUp className="w-10 h-10 text-primary-500" />
                                </div>
                                <h3 className="text-3xl font-black text-white leading-tight tracking-tighter mb-6">
                                    {t('billing_promo_title')}
                                </h3>
                                <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.15em] leading-relaxed">
                                    {t('billing_promo_desc')}
                                </p>
                            </div>
                            <div className="relative z-10 p-6 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                <div className="flex items-center gap-3 text-primary-400 font-black text-[10px] uppercase tracking-widest mb-2">
                                    <Zap className="w-3.5 h-3.5" />
                                    {t('billing_instant_activation')}
                                </div>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        animate={{ x: ["-100%", "400%"] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                        className="w-1/4 h-full bg-primary-500 rounded-full"
                                    />
                                </div>
                            </div>
                        </motion.section>
                    )}

                    <section aria-label="Usage Intelligence">
                        <UsageQuota />
                    </section>
                </div>

                {/* Right Area: Plans & Invoices */}
                <div className="xl:col-span-8 space-y-12">
                    {/* Plans Grid */}
                    <section aria-label="Available subscription plans" className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                        {plans.map((plan, idx) => (
                            <motion.article
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.15 }}
                                key={plan.id}
                                className={`relative card group p-12 bg-white dark:bg-gray-900 border-none rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-700 ${subscription?.plan.id === plan.id
                                    ? 'ring-2 ring-primary-500 border-primary-500 shadow-primary-500/20'
                                    : 'hover:-translate-y-3 hover:shadow-primary-500/10'
                                    }`}
                            >
                                {/* Subtle Mesh for each card */}
                                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
                                    <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary-500/5 rounded-full blur-[60px]" />
                                    <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-indigo-500/5 rounded-full blur-[60px]" />
                                </div>

                                <div>
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{plan.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                                                <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] italic">{t('plan_tier_operational')}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black text-gray-900 dark:text-white">${plan.price / 100}</span>
                                                <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">/{plan.interval}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 mb-16">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-center gap-5 group/feature">
                                                <div className="shrink-0 p-1.5 rounded-xl bg-primary-500/10 border border-primary-500/20 group-hover/feature:bg-primary-500 group-hover/feature:scale-110 transition-all duration-500">
                                                    <CheckCircle className="w-4 h-4 text-primary-500 group-hover/feature:text-white" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 group-hover/feature:text-gray-900 dark:group-hover/feature:text-white transition-colors duration-300">
                                                    {t(feature)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={subscription?.plan.id === plan.id || (actionLoading !== null)}
                                    className={`relative z-10 w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 flex items-center justify-center gap-3 overflow-hidden ${subscription?.plan.id === plan.id
                                        ? 'bg-gray-100 dark:bg-white/5 text-white/20 cursor-default grayscale'
                                        : 'bg-primary-600 hover:bg-gray-900 dark:hover:bg-white dark:hover:text-gray-900 text-white shadow-2xl shadow-primary-500/30'
                                        }`}
                                >
                                    {subscription?.plan.id === plan.id && <div className="absolute inset-0 bg-primary-500/10 blur-[10px]" />}

                                    {actionLoading === plan.id ? (
                                        <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : subscription?.plan.id === plan.id ? (
                                        <span className="flex items-center gap-2 relative z-10 text-primary-500">
                                            <Shield className="w-4 h-4" />
                                            {t('billing_status_active')}
                                        </span>
                                    ) : (
                                        <>
                                            {t('billing_select_plan')}
                                            <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-2 transition-transform duration-500" />
                                        </>
                                    )}
                                </motion.button>
                            </motion.article>
                        ))}
                    </section>

                    {/* Payment Methods Section */}
                    <section aria-labelledby="payment-methods-title" className="card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl rounded-[2.5rem] group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[80px] -translate-y-32 translate-x-32" />

                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-500/10 rounded-2xl shadow-inner group-hover:bg-primary-500 transition-colors duration-500">
                                    <CardIcon className="w-6 h-6 text-primary-500 group-hover:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h3 id="payment-methods-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                        {t('billing_payment_intelligence')}
                                    </h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('billing_stored_protocols')}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleAddMethod}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-500 dark:hover:bg-primary-500 dark:hover:text-white transition-all shadow-xl active:scale-95 disabled:opacity-50"
                            >
                                {actionLoading === 'add-pm' ? (
                                    <div className="w-4 h-4 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                {t('billing_add_method')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            {paymentMethods.length > 0 ? (
                                paymentMethods.map((pm) => (
                                    <div key={pm.id} className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between group/pm hover:border-primary-500/30 transition-all duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-8 bg-gray-900 rounded-md flex items-center justify-center text-[8px] font-black text-white uppercase tracking-tighter">
                                                {pm.card?.brand || 'Card'}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">•••• •••• •••• {pm.card?.last4}</p>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('billing_expires').replace('{date}', `${pm.card?.expMonth}/${pm.card?.expYear}`)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteMethod(pm.id)}
                                            disabled={actionLoading === `delete-${pm.id}`}
                                            className="p-2 text-gray-400 hover:text-error-500 transition-colors opacity-0 group-hover/pm:opacity-100 disabled:opacity-50"
                                        >
                                            {actionLoading === `delete-${pm.id}` ? (
                                                <div className="w-4 h-4 border-2 border-error-500/20 border-t-error-500 rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-2 p-10 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 opacity-40">
                                    <Lock className="w-8 h-8" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('billing_no_secure_methods')}</p>
                                </div>
                            )}
                        </div>

                        {/* PayPal Integration Section */}
                        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                    <Globe className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div className="space-y-0.5">
                                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_paypal_gateway')}</h4>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('billing_global_p2p')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePayPalSubscription('price_pro_monthly')}
                                disabled={actionLoading === 'paypal-price_pro_monthly'}
                                className="flex items-center gap-3 px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLoading === 'paypal-price_pro_monthly' ? (
                                    <div className="w-4 h-4 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Globe className="w-4 h-4" />
                                        {t('billing_subscribe_paypal')}
                                    </>
                                )}
                            </button>
                        </div>
                    </section>

                    {/* Admin Billing Settings (Super User Only) */}
                    {user?.role === 'admin' && (
                        <section aria-labelledby="admin-billing-title" className="card p-10 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 shadow-xl rounded-[2.5rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Settings className="w-32 h-32 text-indigo-500" />
                            </div>

                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h3 id="admin-billing-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                        {t('billing_admin_vault_title')}
                                    </h3>
                                    <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">{t('billing_admin_vault_subtitle')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('billing_stripe_secret')}</p>
                                        <input
                                            type="password"
                                            value={adminKeys.stripeSecretKey}
                                            onChange={(e) => setAdminKeys({ ...adminKeys, stripeSecretKey: e.target.value })}
                                            placeholder="sk_test_••••••••••••••••••••••••"
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs font-mono text-gray-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{t('billing_paypal_id')}</p>
                                        <input
                                            type="text"
                                            value={adminKeys.paypalClientId}
                                            onChange={(e) => setAdminKeys({ ...adminKeys, paypalClientId: e.target.value })}
                                            placeholder="Client ID"
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs font-mono text-gray-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <span className="flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5" />
                                    {t('billing_secure_storage')}
                                </span>
                                <button
                                    onClick={handleAdminUpdate}
                                    disabled={actionLoading === 'admin-update'}
                                    className="px-6 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50 disabled:scale-100 font-black"
                                >
                                    {actionLoading === 'admin-update' ? (t('billing_updating') || 'Updating...') : (t('billing_update_credentials'))}
                                </button>
                            </div>
                        </section>
                    )}
                    <section aria-labelledby="invoices-title" className="card p-0 bg-white dark:bg-gray-900 border-none shadow-2xl overflow-hidden group">
                        <div className="p-10 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-500/10 rounded-2xl shadow-inner group-hover:bg-primary-500 transition-colors duration-500" aria-hidden="true">
                                    <Receipt className="w-6 h-6 text-primary-500 group-hover:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h3 id="invoices-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                        {t('billing_legacy_transactions')}
                                    </h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('billing_transaction_archive')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/30 dark:bg-gray-800/20">
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('billing_timeframe')}</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('billing_evaluation')}</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('billing_execution')}</th>
                                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('billing_download')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {invoices.length > 0 ? (
                                        invoices.map((invoice) => (
                                            <tr key={invoice.id} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors duration-300 group/row">
                                                <td className="px-10 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <Clock className="w-4 h-4 text-gray-300 group-hover/row:text-primary-500" />
                                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{new Date(invoice.created * 1000).toLocaleDateString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6 text-base font-black text-gray-900 dark:text-white">
                                                    {(invoice.amount_paid / 100).toLocaleString('en-US', { style: 'currency', currency: invoice.currency })}
                                                </td>
                                                <td className="px-10 py-6">
                                                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${invoice.status === 'paid'
                                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                        }`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${invoice.status === 'paid' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500'}`} />
                                                        {invoice.status === 'paid' ? t('billing_status_paid') : invoice.status}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    {invoice.invoice_pdf ? (
                                                        <a
                                                            href={invoice.invoice_pdf}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 text-primary-600 hover:text-gray-900 dark:hover:text-white font-black text-xs uppercase tracking-widest transition-all group/pdf"
                                                        >
                                                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover/pdf:bg-primary-600 group-hover/pdf:text-white transition-all">
                                                                <Download className="w-4 h-4" />
                                                            </div>
                                                            PDF
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('billing_unavailable')}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-10 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30">
                                                    <FileText className="w-12 h-12" />
                                                    <p className="font-black uppercase tracking-[0.3em] text-xs">{t('billing_no_records')}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default BillingDashboard;
