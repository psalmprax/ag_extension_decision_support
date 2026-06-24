import React from 'react';
import { CreditCard as CardIcon, Smartphone, Ticket, Globe, Plus, Trash2, Lock } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';

interface PaymentMethodsProps {
    paymentMethods: Array<{ id?: string; card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } }>;
    plans: Array<{ id: string; name: string; price: number }>;
    onAddMethod: () => void;
    onDeleteMethod: (id: string) => void;
    onPayPalSubscription: (planId: string) => void;
    actionLoading: string | null;
    showMobilePayForm: boolean;
    setShowMobilePayForm: (show: boolean) => void;
    mobilePayData: { method: string; planId: string; transactionId: string; amount?: string };
    setMobilePayData: (data: { method: string; planId: string; transactionId: string; amount?: string }) => void;
    handleSubmitTransaction: () => void;
    showVoucherForm: boolean;
    setShowVoucherForm: (show: boolean) => void;
    voucherCode: string;
    setVoucherCode: (code: string) => void;
    handleRedeemVoucher: () => void;
    formMessage: { type: string; text: string } | null;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
    paymentMethods, plans, onAddMethod, onDeleteMethod, onPayPalSubscription,
    actionLoading, showMobilePayForm, setShowMobilePayForm, mobilePayData, setMobilePayData,
    handleSubmitTransaction, showVoucherForm, setShowVoucherForm, voucherCode, setVoucherCode,
    handleRedeemVoucher, formMessage
}) => {
    const { t } = useLanguage();
    const { radiusClass } = useThemeClasses();

    return (
        <section aria-labelledby="payment-methods-title" className={`card p-10 bg-white dark:bg-gray-900 border-none shadow-2xl ${radiusClass} group overflow-hidden relative`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[80px] -translate-y-32 translate-x-32" />
            <div className="flex justify-between items-center mb-10 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-3 bg-primary-500/10 ${radiusClass} shadow-inner group-hover:bg-primary-500 transition-colors duration-500`}><CardIcon className="w-6 h-6 text-primary-500 group-hover:text-white" /></div>
                    <div className="space-y-1"><h3 id="payment-methods-title" className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t('billing_payment_intelligence')}</h3><p className="text-xxs font-black text-gray-400 uppercase tracking-[0.2em]">{t('billing_stored_protocols')}</p></div>
                </div>
                <Button loading={actionLoading === 'add-pm'} onClick={onAddMethod} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-primary-500 dark:hover:bg-primary-500 dark:hover:text-white"><Plus className="w-4 h-4" />{t('billing_add_method')}</Button>
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
                        <Button variant="secondary" size="sm" onClick={() => { setShowMobilePayForm(!showMobilePayForm); }} className="border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white">{t('action_pay_mobile') || 'Pay'}</Button>
                    </div>
                    {showMobilePayForm && (
                        <div className="mt-4 pt-4 border-t border-green-500/20 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={mobilePayData.method} onChange={(e) => setMobilePayData({ ...mobilePayData, method: e.target.value })} options={[{ value: 'mpesa', label: 'M-Pesa' }, { value: 'airtel', label: 'Airtel Money' }, { value: 'bank', label: 'Bank Transfer' }]} />
                                <Select value={mobilePayData.planId} onChange={(e) => { const p = plans.find(pl => pl.id === e.target.value); setMobilePayData({ ...mobilePayData, planId: e.target.value, amount: p ? (p.price / 100).toString() : '' }); }} options={[{ value: '', label: 'Select Plan' }, ...plans.filter((p: { id: string; name: string; price: number }) => p.price > 0).map((p: { id: string; name: string; price: number }) => ({ value: p.id, label: `${p.name} ($${(p.price / 100).toFixed(2)}/mo)` }))] } />
                            </div>
                            <Input type="text" value={mobilePayData.transactionId} onChange={(e) => setMobilePayData({ ...mobilePayData, transactionId: e.target.value })} placeholder="Enter M-Pesa/Airtel Transaction ID" />
                            <div className="flex items-center justify-between">
                                <p className="text-xxs text-gray-400">Admin will verify your payment before activation.</p>
                                <Button loading={actionLoading === 'mobile-pay'} disabled={!mobilePayData.transactionId || !mobilePayData.planId} onClick={handleSubmitTransaction} className="bg-green-500 text-white hover:bg-green-600 font-black uppercase tracking-widest text-xxs">Submit Transaction</Button>
                            </div>
                            {formMessage && <p className={`text-xs font-medium ${formMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{formMessage.text}</p>}
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
                        <Button variant="secondary" size="sm" onClick={() => { setShowVoucherForm(!showVoucherForm); }} className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white">{t('action_redeem') || 'Redeem'}</Button>
                    </div>
                    {showVoucherForm && (
                        <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-3">
                            <Input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="Enter voucher code (e.g. AGV-A1B2C3D4)" className="font-mono tracking-wider" />
                            <div className="flex items-center justify-between">
                                <p className="text-xxs text-gray-400">Instantly activates your subscription.</p>
                                <Button loading={actionLoading === 'voucher'} disabled={!voucherCode.trim()} onClick={handleRedeemVoucher} className="bg-indigo-500 text-white hover:bg-indigo-600 font-black uppercase tracking-widest text-xxs">Activate Voucher</Button>
                            </div>
                            {formMessage && <p className={`text-xs font-medium ${formMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{formMessage.text}</p>}
                        </div>
                    )}
                </div>
                {paymentMethods.length > 0 ? paymentMethods.map((pm) => (
                    <div key={pm.id} className={`p-6 ${radiusClass} bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between group/pm hover:border-primary-500/30 transition-all duration-300`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-8 bg-gray-900 ${radiusClass} flex items-center justify-center text-[8px] font-black text-white uppercase tracking-tighter`}>{pm.card?.brand || 'Card'}</div>
                            <div className="space-y-1"><p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">•••• •••• •••• {pm.card?.last4}</p><p className="text-xxs font-black text-gray-400 uppercase tracking-widest">{t('billing_expires').replace('{date}', `${pm.card?.exp_month}/${pm.card?.exp_year}`)}</p></div>
                        </div>
                        <button onClick={() => pm.id && onDeleteMethod(pm.id)} disabled={actionLoading === `delete-${pm.id}`} className="p-2 text-gray-400 hover:text-error-500 transition-colors opacity-0 group-hover/pm:opacity-100 disabled:opacity-50">
                            {actionLoading === `delete-${pm.id}` ? <div className="w-4 h-4 border-2 border-error-500/20 border-t-error-500 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
                <Button variant="secondary" loading={actionLoading === 'paypal-price_pro_monthly'} onClick={() => onPayPalSubscription('price_pro_monthly')} className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white"><Globe className="w-4 h-4" />{t('billing_subscribe_paypal')}</Button>
            </div>
        </section>
    );
};
