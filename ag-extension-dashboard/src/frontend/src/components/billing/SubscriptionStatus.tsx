import React from 'react';
import { Zap, Clock, ExternalLink, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Badge } from '../ui/Badge';

interface SubscriptionStatusProps {
  subscription: {
    plan?: { name?: string };
    currentPeriodEnd?: string;
    [key: string]: unknown;
  } | null;
  onPortal: () => void;
  actionLoading: string | null;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  subscription,
  onPortal,
  actionLoading,
}) => {
  const { t } = useLanguage();
  const { radiusClass } = useThemeClasses();

  if (subscription) {
    return (
      <motion.section
        aria-labelledby="subscription-status-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative card p-8 lg:p-10 group bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-2xl border border-emerald-500/30 shadow-2xl overflow-hidden min-h-[440px] flex flex-col justify-between"
        style={{ borderRadius: 'var(--radius-card, 1.5rem)' }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-1/4 -right-1/4 w-full h-full bg-emerald-500/15 rounded-full blur-[90px]"
          />
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3.5 bg-emerald-500/15 rounded-2xl backdrop-blur-xl border border-emerald-500/30 shadow-lg shadow-emerald-950/40 text-emerald-400">
              <Zap className="w-7 h-7" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xxs font-black uppercase tracking-widest text-emerald-400 mb-1">
                {t('billing_status_label') || 'MEMBERSHIP'}
              </span>
              <Badge variant="success" size="sm">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse mr-1" />
                {t('billing_status_active') || 'ACTIVE'}
              </Badge>
            </div>
          </div>

          <span
            id="subscription-status-title"
            className="text-xxs font-black uppercase tracking-widest text-slate-400 mb-2 block"
          >
            {t('billing_current_plan') || 'Current Plan'}
          </span>
          <h2 className="text-3xl font-black text-white leading-none tracking-tighter mb-4 group-hover:text-emerald-400 transition-colors duration-300">
            {subscription?.plan?.name ?? 'N/A'}
          </h2>
          <div className="flex items-center gap-2.5 text-slate-400 font-mono text-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>
              {t('billing_renews_on') || 'Renews on'}{' '}
              {subscription?.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : 'N/A'}
            </span>
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-slate-800 space-y-3">
          <button
            onClick={onPortal}
            disabled={actionLoading === 'portal'}
            className={`w-full h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white ${radiusClass} font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.98] disabled:opacity-50`}
          >
            {actionLoading === 'portal' ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4 text-emerald-400" />
            )}
            <span>{t('billing_manage_subscription') || 'MANAGE SUBSCRIPTION'}</span>
          </button>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative p-8 lg:p-10 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-2xl ${radiusClass} border border-emerald-500/20 shadow-2xl overflow-hidden min-h-[440px] flex flex-col justify-between`}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px]" />
      <div className="relative z-10">
        <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 w-fit mb-6 text-emerald-400">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h3 className="text-3xl font-black text-white leading-tight tracking-tighter mb-4">
          {t('billing_promo_title') || 'Scale Your Agricultural Reach'}
        </h3>
        <p className="text-slate-400 font-medium text-xs leading-relaxed">
          {t('billing_promo_desc') || 'Unlock AI automated agronomic triage, multi-channel SMS broadcasts, and satellite NDVI maps.'}
        </p>
      </div>
      <div className="relative z-10 p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 text-emerald-400 font-black text-xxs uppercase tracking-widest mb-2">
          <Zap className="w-3.5 h-3.5" />
          <span>{t('billing_instant_activation') || 'INSTANT ACTIVATION'}</span>
        </div>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-1/4 h-full bg-emerald-500 rounded-full"
          />
        </div>
      </div>
    </motion.section>
  );
};
