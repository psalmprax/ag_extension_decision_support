import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import {
    fetchPlans,
    fetchSubscription,
    createCheckoutSession,
    createPortalSession,
    fetchInvoices,
    switchSubscription,
    fetchPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    updateAdminConfig,
    createPayPalSubscription,
    redeemVoucher,
    submitTransaction,
    getMyTransactions,
    listAllTransactions,
    verifyTransaction,
    rejectTransaction,
    generateVouchers,
    listVouchers
} from '@/api/billingService';

interface Plan { id: string; name: string; price: number; interval: string; features: string[]; }
interface Subscription { id: string; status: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; plan: Plan; }
interface Invoice { id: string; amount_paid: number; currency: string; status: string; created: number; invoice_pdf: string; }
interface PaymentMethod { id: string; type: string; brand?: string; last4?: string; isDefault?: boolean; card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number; }; }
interface Transaction { id: string; transactionId?: string; amount: number; currency: string; status: string; method: string; createdAt: string; userId?: string; userName?: string; userEmail?: string; planId?: string; }
interface Voucher { id: string; code: string; planId: string; status: string; expiresAt: string; redeemedBy?: string; }
interface ConfirmModal { title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'warning' | 'info' | 'success'; confirmText?: string; }

export type { Plan, Subscription, Invoice, PaymentMethod, Transaction, Voucher, ConfirmModal };

export function useBillingActions() {
    const { t } = useLanguage();
    const { user } = useAppStore();
    const [searchParams, setSearchParams] = useSearchParams();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [adminKeys, setAdminKeys] = useState({ stripeSecretKey: '', paypalClientId: '' });
    const [showMobilePayForm, setShowMobilePayForm] = useState(false);
    const [showVoucherForm, setShowVoucherForm] = useState(false);
    const [mobilePayData, setMobilePayData] = useState({ method: 'mpesa' as 'mpesa' | 'airtel' | 'bank', transactionId: '', planId: '', amount: '' });
    const [voucherCode, setVoucherCode] = useState('');
    const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [myTransactions, setMyTransactions] = useState<Transaction[]>([]);
    const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [voucherBatch, setVoucherBatch] = useState({ planId: 'price_pro_monthly', count: 10, expiresInDays: 30 });
    const [rejectReason, setRejectReason] = useState('');
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
    const [configErrors, setConfigErrors] = useState<{ stripe?: boolean; paypal?: boolean }>({});
    const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

    const success = searchParams.get('success') === 'true';
    const canceled = searchParams.get('canceled') === 'true';

    useEffect(() => {
        if (success || canceled) {
            const timer = setTimeout(() => setSearchParams({}), 3000);
            return () => clearTimeout(timer);
        }
    }, [success, canceled, setSearchParams]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [plansRes, subRes, invoicesRes, pmRes] = await Promise.all([
                fetchPlans(), fetchSubscription(), fetchInvoices(), fetchPaymentMethods()
            ]);

            if (plansRes?.success) setPlans(plansRes.data);
            if (subRes?.success) setSubscription(subRes.data);

            const newConfigErrors: { stripe?: boolean; paypal?: boolean } = {};
            if (invoicesRes?.success) setInvoices(invoicesRes.data);
            else if (invoicesRes?.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED') newConfigErrors.stripe = true;

            if (pmRes?.success) setPaymentMethods(pmRes.data);
            else if (pmRes?.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED') newConfigErrors.stripe = true;

            setConfigErrors(newConfigErrors);

            const myTxRes = await getMyTransactions();
            if (myTxRes?.success) setMyTransactions(myTxRes.data);

            if (user?.role === 'admin') {
                const [adminTxRes, voucherRes] = await Promise.all([listAllTransactions('pending'), listVouchers()]);
                if (adminTxRes?.success) setAdminTransactions(adminTxRes.data);
                if (voucherRes?.success) setVouchers(voucherRes.data);
            }
        } catch (error) {
            console.error('Failed to fetch billing data:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.role]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRedeemVoucher = async () => {
        if (!voucherCode.trim()) return;
        setActionLoading('voucher');
        setFormMessage(null);
        try {
            const res = await redeemVoucher(voucherCode.trim());
            if (res.success) {
                setFormMessage({ type: 'success', text: res.message || `Successfully activated ${res.data?.planName || 'plan'}!` });
                setVoucherCode('');
                setShowVoucherForm(false);
                fetchData();
            } else {
                setFormMessage({ type: 'error', text: res.message || 'Voucher redemption failed.' });
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            setFormMessage({ type: 'error', text: err.response?.data?.message || 'Voucher redemption failed.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitTransaction = async () => {
        if (!mobilePayData.transactionId || !mobilePayData.planId || !mobilePayData.amount) return;
        setActionLoading('mobile-pay');
        setFormMessage(null);
        try {
            const res = await submitTransaction({
                planId: mobilePayData.planId, method: mobilePayData.method,
                transactionId: mobilePayData.transactionId, amount: parseFloat(mobilePayData.amount)
            });
            if (res.success) {
                setFormMessage({ type: 'success', text: res.message || 'Transaction submitted for verification!' });
                setMobilePayData({ method: 'mpesa', transactionId: '', planId: '', amount: '' });
                setShowMobilePayForm(false);
                fetchData();
            } else {
                setFormMessage({ type: 'error', text: res.message || 'Submission failed.' });
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            setFormMessage({ type: 'error', text: err.response?.data?.message || 'Submission failed.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleVerifyTransaction = async (id: string) => {
        setActionLoading(`verify-${id}`);
        try { await verifyTransaction(id); fetchData(); }
        catch (error) { console.error('Verification failed:', error); }
        finally { setActionLoading(null); }
    };

    const handleRejectTransaction = async () => {
        if (!selectedTransactionId || !rejectReason.trim()) return;
        setActionLoading(`reject-${selectedTransactionId}`);
        try {
            const res = await rejectTransaction(selectedTransactionId, rejectReason);
            if (res.success) { setSelectedTransactionId(null); setRejectReason(''); fetchData(); }
        } catch (error) { console.error('Rejection failed:', error); }
        finally { setActionLoading(null); }
    };

    const handleGenerateVouchers = async () => {
        setActionLoading('generate-vouchers');
        try {
            const res = await generateVouchers(voucherBatch.planId, voucherBatch.count, voucherBatch.expiresInDays);
            if (res.success) { fetchData(); toast.success(`Successfully generated ${voucherBatch.count} vouchers!`); }
        } catch (error) { console.error('Generation failed:', error); }
        finally { setActionLoading(null); }
    };

    const handleSubscribe = async (priceId: string, billingCycle: 'current' | 'next' = 'current') => {
        setActionLoading(priceId);
        try {
            const response = await createCheckoutSession(priceId, billingCycle);
            if (!response.success) {
                if (response.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED') { toast.error(t('billing_configuration_alert') || response.message); return; }
                if (response.errorCode === 'ALREADY_SUBSCRIBED') {
                    const canSchedule = !response.subscription?.cancelAtPeriodEnd;
                    setConfirmModal({ title: 'Subscription Exists', message: canSchedule ? `${response.message} ${t('confirm_next_cycle')}` : `${response.message} ${t('confirm_reenable_renewal')}`, variant: 'warning', confirmText: 'Schedule for Next Cycle', onConfirm: () => { setConfirmModal(null); handleSubscribe(priceId, 'next'); } });
                    return;
                }
                if (response.errorCode === 'ACTIVE_SUBSCRIPTION_EXISTS') {
                    const isSamePlan = response.currentSubscription?.plan?.stripePriceId === priceId;
                    if (isSamePlan) {
                        setConfirmModal({ title: 'Plan Continuation', message: t('confirm_plan_continuation'), variant: 'info', confirmText: 'Continue', onConfirm: () => { setConfirmModal(null); handleSubscribe(priceId, 'next'); } });
                    } else {
                        setConfirmModal({ title: 'Switch Plan', message: `${response.message}\n\n${t('confirm_switch_plan')}`, variant: 'warning', confirmText: 'Switch Now', onConfirm: () => { setConfirmModal(null); handleSwitch(priceId, 'current'); } });
                    }
                    return;
                }
                toast.error(response.message || 'Action failed');
                return;
            }
            if (response.data?.url) { window.location.href = response.data.url; return; }
            if (response.message) { toast.success(response.message); fetchData(); }
        } catch (error: unknown) {
            if (import.meta.env.DEV) console.error('Subscription failed:', error);
            toast.error('Subscription failed. Please try again.');
        } finally { setActionLoading(null); }
    };

    const handleSwitch = async (priceId: string, billingCycle: 'current' | 'next' = 'current') => {
        setActionLoading(`switch-${priceId}`);
        try {
            const data = await switchSubscription(priceId, billingCycle);
            if (data.success) { toast.success(data.message || 'Plan switched successfully!'); fetchData(); }
            else { toast.error(data.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED' ? (t('billing_configuration_alert') || data.message) : (data.message || 'Failed to switch plan')); }
        } catch (error: unknown) {
            if (import.meta.env.DEV) console.error('Switch failed:', error);
            toast.error('Failed to switch plan. Please try again.');
        } finally { setActionLoading(null); }
    };

    const handlePortal = async () => {
        setActionLoading('portal');
        try {
            const data = await createPortalSession();
            if (data.success && data.data.url) window.location.href = data.data.url;
            else if (!data.success) toast.error(data.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED' ? (t('billing_configuration_alert') || data.message || 'Billing portal unavailable.') : (data.message || 'Failed to open billing portal.'));
        } catch (error) {
            if (import.meta.env.DEV) console.error('Portal access failed:', error);
            toast.error('Failed to open billing portal. Please try again.');
        } finally { setActionLoading(null); }
    };

    const handleAddMethod = async () => {
        setActionLoading('add-pm');
        try {
            const response = await addPaymentMethod('card');
            if (response.success && response.data?.url) window.location.href = response.data.url;
            else if (response.success) { toast.success(response.message || 'Payment method setup initiated successfully!'); fetchData(); }
            else toast.error(response.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED' ? (t('billing_configuration_alert') || response.message) : (response.error || response.message || 'Failed to initialize payment method setup'));
        } catch (error: unknown) {
            if (import.meta.env.DEV) console.error('Failed to add payment method:', error);
            toast.error('Failed to add payment method. Please try again.');
        } finally { setActionLoading(null); }
    };

    const handleDeleteMethod = async (id: string) => {
        setConfirmModal({
            title: 'Remove Payment Method', message: t('confirm_delete_payment_method') || 'Are you sure you want to remove this payment method?',
            variant: 'danger', confirmText: 'Remove',
            onConfirm: async () => {
                setConfirmModal(null); setActionLoading(`delete-${id}`);
                try { const response = await deletePaymentMethod(id); if (response.success) { toast.success(response.message || 'Payment method removed'); fetchData(); } }
                catch (error) { console.error('Failed to delete payment method:', error); toast.error('Failed to delete payment method'); }
                finally { setActionLoading(null); }
            }
        });
    };

    const handlePayPalSubscription = async (planId: string) => {
        setActionLoading(`paypal-${planId}`);
        try {
            const response = await createPayPalSubscription(planId);
            if (response.success && response.data?.approvalUrl) window.location.href = response.data.approvalUrl;
            else if (!response.success) toast.error(response.errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED' ? (t('billing_configuration_alert') || response.message) : (response.message || 'Failed to initiate PayPal subscription'));
        } catch (error) {
            if (import.meta.env.DEV) console.error('PayPal subscription failed:', error);
            toast.error('Failed to create PayPal subscription. Please try again.');
        } finally { setActionLoading(null); }
    };

    const handleAdminUpdate = async () => {
        if (!adminKeys.stripeSecretKey && !adminKeys.paypalClientId) { toast.error("Please enter at least one credential to update."); return; }
        setActionLoading('admin-update');
        try {
            const response = await updateAdminConfig(adminKeys);
            if (response.success) { toast.success(response.message || 'Credentials updated successfully'); setAdminKeys({ stripeSecretKey: '', paypalClientId: '' }); }
        } catch (error) { console.error('Failed to update credentials:', error); toast.error('Failed to update credentials. Ensure you have admin privileges.'); }
        finally { setActionLoading(null); }
    };

    return {
        plans, subscription, invoices, paymentMethods, loading, actionLoading,
        adminKeys, setAdminKeys, showMobilePayForm, setShowMobilePayForm,
        showVoucherForm, setShowVoucherForm, mobilePayData, setMobilePayData,
        voucherCode, setVoucherCode, formMessage, setFormMessage,
        myTransactions, adminTransactions, vouchers, voucherBatch, setVoucherBatch,
        rejectReason, setRejectReason, selectedTransactionId, setSelectedTransactionId,
        configErrors, confirmModal, setConfirmModal, success, canceled, user,
        fetchData, handleRedeemVoucher, handleSubmitTransaction, handleVerifyTransaction,
        handleRejectTransaction, handleGenerateVouchers, handleSubscribe, handleSwitch,
        handlePortal, handleAddMethod, handleDeleteMethod, handlePayPalSubscription,
        handleAdminUpdate,
    };
}
