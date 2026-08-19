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

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  index,
  isCurrentPlan,
  onSelect,
  actionLoading,
}) => {
  const { t } = useLanguage();
  const { radiusClass } = useThemeClasses();

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className={`relative card group p-8 lg:p-10 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-2xl border flex flex-col justify-between overflow-hidden transition-all duration-500 shadow-2xl ${
        isCurrentPlan
          ? 'ring-2 ring-emerald-500/80 border-emerald-500/60 shadow-emerald-950/50'
          : 'border-slate-800/80 hover:border-emerald-500/40 hover:-translate-y-2 hover:shadow-emerald-950/30'
      }`}
      style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}
    >
      {/* KnockKnock Ambient Glow Orb */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute -top-1/3 -right-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
        <div className="absolute -bottom-1/3 -left-1/3 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px]" />
      </div>

      {plan.id === 'price_pro_monthly' && (
        <div className="mb-6 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-400 text-xxs font-black rounded-full uppercase tracking-[0.2em] border border-emerald-500/30 backdrop-blur-md relative z-10 w-fit">
          <Shield className="w-3.5 h-3.5" />
          {t('plan_badge_officer') || 'Recommended for Extension Officers'}
        </div>
      )}
      {plan.id === 'price_free' && (
        <div className="mb-6 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-300 text-xxs font-black rounded-full uppercase tracking-[0.2em] border border-slate-700 backdrop-blur-md relative z-10 w-fit">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          {t('plan_badge_farmer') || 'Ideal for Individual Farmers'}
        </div>
      )}

      <div>
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1.5">
            <h3 className="text-3xl font-black text-white tracking-tighter leading-none">
              {plan.name}
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xxs font-black text-emerald-400 uppercase tracking-[0.2em]">
                {t('plan_tier_operational') || 'OPERATIONAL TIER'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">
                ${plan.price / 100}
              </span>
              <span className="text-slate-400 font-bold uppercase text-xxs tracking-widest">
                /{plan.interval}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          {plan.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-3.5 group/feature">
              <div className="shrink-0 p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 group-hover/feature:bg-emerald-500/20 group-hover/feature:scale-105 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-slate-300 group-hover/feature:text-white transition-colors duration-200">
                {t(feature)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(plan.id)}
        disabled={isCurrentPlan || actionLoading !== null}
        className={`relative z-10 w-full h-14 ${radiusClass} font-black uppercase tracking-[0.2em] text-xs transition-all duration-300 flex items-center justify-center gap-2.5 overflow-hidden ${
          isCurrentPlan
            ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-default'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/50'
        }`}
      >
        {actionLoading === plan.id ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : isCurrentPlan ? (
          <span className="flex items-center gap-2 relative z-10 text-emerald-400">
            <Shield className="w-4 h-4" />
            {t('billing_status_active') || 'CURRENT PLAN'}
          </span>
        ) : (
          <>
            <span>{t('billing_select_plan') || 'UPGRADE TIER'}</span>
            <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1.5 transition-transform duration-300" />
          </>
        )}
      </motion.button>
    </motion.article>
  );
};
