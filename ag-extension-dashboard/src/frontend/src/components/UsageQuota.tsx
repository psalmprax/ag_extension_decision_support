import { hasAuthSession } from '@/hooks/useAppAuth';
import { appLocale } from '@/lib/appLocale';
import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, FileText, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchUsage } from '@/api/billingService';
import { useLanguage } from '@/lib/LanguageContext';

interface QuotaBarProps {
  label: string;
  current: number;
  limit: number;
  icon: React.ElementType;
  color: string;
}

const QuotaBar = ({
  label,
  current,
  limit,
  icon: Icon,
  color,
}: QuotaBarProps) => {
  const { t } = useLanguage();
  const isUnlimited = limit === -1;
  // A limit of 0 means the plan does not include it: no percentage (it was "NaN%").
  const notIncluded = limit === 0;
  const percentage = isUnlimited || notIncluded ? 0 : Math.min(Math.round((current / limit) * 100), 100);
  const isHigh = !isUnlimited && !notIncluded && percentage > 80;

  return (
    <div className="space-y-2.5 group/bar">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-inner transition-all group-hover/bar:scale-105"
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xxs font-medium text-slate-600 dark:text-theme-text-muted block leading-none mb-1">
              {label}
            </span>
            <span
              className={`text-xs font-mono font-medium ${isHigh ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-theme-text-primary'}`}
            >
              {current.toLocaleString(appLocale())}{' '}
              <span className="text-slate-600 dark:text-theme-text-muted font-normal">
                / {isUnlimited ? '∞' : limit.toLocaleString(appLocale())}
              </span>
            </span>
          </div>
        </div>
        <div className="text-end">
          <span
            className={`text-xxs font-medium font-mono ${isHigh ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}
          >
            {isUnlimited
              ? t('usage_unlimited', { defaultValue: 'Unlimited' })
              : notIncluded
                ? t('usage_not_included', { defaultValue: 'Not included' })
                : `${percentage}%`}
          </span>
        </div>
      </div>
      <div className="relative h-2 w-full bg-slate-50 dark:bg-theme-bg-secondary rounded-full overflow-hidden border border-slate-900/[0.08] dark:border-white/[0.08] shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: isUnlimited ? '100%' : `${percentage}%` }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
          className={`absolute inset-y-0 start-0 rounded-full ${color} transition-all duration-300 ${isUnlimited ? 'opacity-30' : ''}`}
        />
      </div>
    </div>
  );
};

export const UsageQuota = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useLanguage();
  const { data: usageResponse, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: fetchUsage,
    refetchInterval: 60000,
    enabled: hasAuthSession(),
  });

  const usageData = usageResponse?.data?.usage || [];
  const plan = usageResponse?.data?.plan;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse bg-white dark:bg-theme-bg-primary rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08]">
        <div className="h-4 bg-slate-100 dark:bg-theme-bg-tertiary rounded-full w-1/3"></div>
        <div className="space-y-4">
          <div className="h-3 bg-slate-100 dark:bg-theme-bg-tertiary rounded-full"></div>
          <div className="h-3 bg-slate-100 dark:bg-theme-bg-tertiary rounded-full"></div>
          <div className="h-3 bg-slate-100 dark:bg-theme-bg-tertiary rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!plan || usageData.length === 0) {
    return (
      <div
        className={`relative overflow-hidden ${compact ? '' : 'p-6 bg-white dark:bg-theme-bg-secondary/60 border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl'}`}
      >
        <div className="relative z-10 flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-sm text-emerald-700 dark:text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary mb-1">
            {t('usage_init_title') || 'Realtime quota telemetry'}
          </h4>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted max-w-xs leading-relaxed mb-4">
            {t('usage_init_desc') || 'Automatic telemetry tracking for SMS dispatch, AI queries, and telemetry synthesis.'}
          </p>
          <div className="w-full h-1 bg-slate-900/[0.03] dark:bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-1/2 h-full bg-emerald-500/50 blur-[1px]"
            />
          </div>
        </div>
      </div>
    );
  }

  const typeConfig: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    sms: { icon: Send, color: 'bg-emerald-500' },
    ai_chat: { icon: MessageSquare, color: 'bg-slate-400' },
    report: { icon: FileText, color: 'bg-slate-500' },
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-500 ${compact ? '' : 'p-6 bg-white dark:bg-theme-bg-secondary/60 border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl group'}`}
    >
      {!compact && (
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary tracking-tight">
                {t('billing_quota_usage') || 'Quota & seats'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-theme-text-muted">
                {t('usage_realtime_telemetry') || 'Live agronomy quota'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="px-3 py-1 rounded-xl bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-theme-text-secondary font-mono">
              {t('ui_billing_dashboard_tier')} <strong className="text-slate-900 dark:text-theme-text-primary">{plan.name}</strong>
            </span>
          </div>
        </div>
      )}

      <div className={`grid gap-5 ${compact ? 'space-y-3' : 'grid-cols-1'} relative z-10`}>
        {usageData.map((item: { type: string; label: string; current: number; limit: number }) => {
          const config = typeConfig[item.type] || typeConfig['sms'];
          return (
            <QuotaBar
              key={item.type}
              label={t(`usage_type_${item.type}`, { defaultValue: item.label })}
              current={item.current}
              limit={item.limit}
              icon={config.icon}
              color={config.color}
            />
          );
        })}
      </div>

      {(() => {
        const smsUsage = usageData.find(
          (u: { type: string; current: number; limit: number }) => u.type === 'sms'
        );
        if (!compact && smsUsage && smsUsage.limit > 0 && smsUsage.current / smsUsage.limit > 0.9) {
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 backdrop-blur-md relative overflow-hidden"
            >
              <div className="relative z-10 shrink-0 p-1.5 bg-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="relative z-10">
                <h5 className="text-xs font-medium text-rose-700 dark:text-rose-400 mb-0.5">
                  {t('usage_critical_threshold') || 'Quota Warning'}
                </h5>
                <p className="text-xs text-slate-700 dark:text-theme-text-secondary leading-relaxed">
                  {t('billing_limit_warning') || 'You have utilized over 90% of your SMS broadcast pool. Upgrade tier to avoid disruption.'}
                </p>
              </div>
            </motion.div>
          );
        }
        return null;
      })()}
    </div>
  );
};
