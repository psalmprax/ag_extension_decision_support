import React from 'react';
import { Zap, Clock, ExternalLink, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Badge } from '../ui/Badge';

interface SubscriptionStatusProps {
    subscription: unknown;
    onPortal: () => void;
    actionLoading: string | null;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ subscription, onPortal, actionLoading }) => {
    const { t } = useLanguage();
    const { radiusClass } = useThemeClasses();

    if (subscription) {
        return (
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
                    <h2 className="text-3xl font-black text-white leading-none tracking-tighter mb-4 group-hover:text-primary-400 transition-colors duration-500">{subscription.plan.name}</h2>
                    <div className="flex items-center gap-3 text-white/40 font-black text-xxs uppercase tracking-widest">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <span>{t('billing_renews_on')} {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="relative z-10 pt-8 border-t border-white/10 space-y-4">
                    <button onClick={onPortal} disabled={actionLoading === 'portal'}
                        className={`w-full h-16 bg-white text-gray-900 ${radiusClass} font-black uppercase tracking-widest text-xs hover:bg-primary-500 hover:text-white transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] disabled:opacity-50`}>
                        {actionLoading === 'portal' ? <div className="w-5 h-5 border-3 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" /> : <ExternalLink className="w-5 h-5" />}
                        {t('billing_manage_subscription')}
                    </button>
                </div>
            </motion.section>
        );
    }

    return (
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
    );
};
