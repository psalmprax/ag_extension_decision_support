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
  glowColor,
}: QuotaBarProps & { glowColor: string }) => {
  const { t } = useLanguage();
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(Math.round((current / limit) * 100), 100);
  const isHigh = !isUnlimited && percentage > 80;

  return (
    <div className="space-y-2.5 group/bar">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner transition-all group-hover/bar:scale-105"
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xxs font-black uppercase tracking-widest text-slate-400 block leading-none mb-1">
              {label}
            </span>
            <span
              className={`text-xs font-mono font-bold ${isHigh ? 'text-rose-400' : 'text-white'}`}
            >
              {current.toLocaleString()}{' '}
              <span className="text-slate-500 font-normal">
                / {isUnlimited ? '∞' : limit.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`text-xxs font-black font-mono ${isHigh ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}
          >
            {isUnlimited ? t('usage_unlimited') || 'UNLIMITED' : `${percentage}%`}
          </span>
        </div>
      </div>
      <div className="relative h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: isUnlimited ? '100%' : `${percentage}%` }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${color} transition-all duration-300 ${isUnlimited ? 'opacity-30' : ''}`}
          style={{
            boxShadow: isUnlimited || percentage > 5 ? `0 0 15px ${glowColor}` : 'none',
          }}
        >
          {/* Shimmer wave effect */}
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 opacity-40 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.6)_50%,transparent_100%)] skew-x-12"
          />
        </motion.div>
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
    enabled: !!localStorage.getItem('token'),
  });

  const usageData = usageResponse?.data?.usage || [];
  const plan = usageResponse?.data?.plan;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse bg-slate-950/80 rounded-xl border border-slate-800">
        <div className="h-4 bg-slate-800 rounded-full w-1/3"></div>
        <div className="space-y-4">
          <div className="h-3 bg-slate-800/60 rounded-full"></div>
          <div className="h-3 bg-slate-800/60 rounded-full"></div>
          <div className="h-3 bg-slate-800/60 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!plan || usageData.length === 0) {
    return (
      <div
        className={`relative overflow-hidden ${compact ? '' : 'p-6 bg-slate-900/60 border border-white/10 rounded-xl shadow-xl backdrop-blur-xl'}`}
      >
        <div className="relative z-10 flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-lg shadow-emerald-950/40 text-emerald-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">
            {t('usage_init_title') || 'Realtime Quota Telemetry'}
          </h4>
          <p className="text-xs text-white/60 max-w-xs leading-relaxed mb-4">
            {t('usage_init_desc') || 'Automatic telemetry tracking for SMS dispatch, AI queries, and telemetry synthesis.'}
          </p>
          <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
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
    { icon: React.ComponentType<{ className?: string }>; color: string; glow: string }
  > = {
    sms: { icon: Send, color: 'from-emerald-500 to-teal-400', glow: 'rgba(16,185,129,0.5)' },
    ai_chat: {
      icon: MessageSquare,
      color: 'from-indigo-500 to-cyan-400',
      glow: 'rgba(99,102,241,0.5)',
    },
    report: {
      icon: FileText,
      color: 'from-purple-500 to-pink-500',
      glow: 'rgba(168,85,247,0.5)',
    },
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-500 ${compact ? '' : 'p-6 bg-slate-900/60 border border-white/10 rounded-xl shadow-xl backdrop-blur-xl group'}`}
    >
      {!compact && (
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                {t('billing_quota_usage') || 'Quota & Seats'}
              </h4>
              <p className="text-xs text-white/60">
                {t('usage_realtime_telemetry') || 'Live Agronomy Quota'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="px-3 py-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/80 font-mono">
              Tier: <strong className="text-white">{plan.name}</strong>
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
              label={item.label}
              current={item.current}
              limit={item.limit}
              icon={config.icon}
              color={config.color}
              glowColor={config.glow}
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
              <div className="relative z-10 shrink-0 p-1.5 bg-rose-500/20 rounded-lg text-rose-400">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="relative z-10">
                <h5 className="text-xxs font-bold text-rose-400 uppercase tracking-widest mb-0.5">
                  {t('usage_critical_threshold') || 'Quota Warning'}
                </h5>
                <p className="text-xs text-white/70 leading-relaxed">
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
