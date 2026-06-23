import React from 'react';
import { CheckCircle, Shield, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface Plan {
    id: string;
    name: string;
    price: number;
    interval: string;
    features: string[];
}

interface PlanCardProps {
    plan: Plan;
    index: number;
    isCurrentPlan: boolean;
    onSelect: (planId: string) => void;
    actionLoading: string | null;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, index, isCurrentPlan, onSelect, actionLoading }) => {
    const { t } = useLanguage();
    const { radiusClass } = useThemeClasses();

    return (
        <motion.article initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.15 }}
            className={`relative card group p-12 bg-white dark:bg-gray-900 border-none shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-700 ${isCurrentPlan ? 'ring-2 ring-primary-500 border-primary-500 shadow-primary-500/20' : 'hover:-translate-y-3 hover:shadow-primary-500/10'}`}
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
                onClick={() => onSelect(plan.id)}
                disabled={isCurrentPlan || (actionLoading !== null)}
                className={`relative z-10 w-full h-16 ${radiusClass} font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 flex items-center justify-center gap-3 overflow-hidden ${isCurrentPlan ? 'bg-gray-100 dark:bg-white/5 text-white/20 cursor-default grayscale' : 'bg-primary-600 hover:bg-gray-900 dark:hover:bg-white dark:hover:text-gray-900 text-white shadow-2xl shadow-primary-500/30'}`}>
                {isCurrentPlan && <div className="absolute inset-0 bg-primary-500/10 blur-[10px]" />}
                {actionLoading === plan.id ? <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" /> :
                    isCurrentPlan ? <span className="flex items-center gap-2 relative z-10 text-primary-500"><Shield className="w-4 h-4" />{t('billing_status_active')}</span> :
                        <>{t('billing_select_plan')}<ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-2 transition-transform duration-500" /></>}
            </motion.button>
        </motion.article>
    );
};
