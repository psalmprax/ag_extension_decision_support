import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, FileText, AlertCircle, TrendingUp } from 'lucide-react';
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

const QuotaBar = ({ label, current, limit, icon: Icon, color, glowColor }: QuotaBarProps & { glowColor: string }) => {
    const { t } = useLanguage();
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 0 : Math.min(Math.round((current / limit) * 100), 100);
    const isHigh = !isUnlimited && percentage > 80;

    return (
        <div className="space-y-3 group/bar">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-white/5 shadow-sm transition-all group-hover/bar:scale-110 duration-500 border border-white/5`}>
                        <Icon className={`w-3.5 h-3.5 ${color.replace('from-', 'text-').split(' ')[0]}`} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 block leading-none mb-1.5">
                            {label}
                        </span>
                        <span className={`text-xs font-black ${isHigh ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {current.toLocaleString()} <span className="text-gray-400 dark:text-gray-600 font-bold">/ {isUnlimited ? '∞' : limit.toLocaleString()}</span>
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-[10px] font-black ${isHigh ? 'text-red-500 animate-pulse' : 'text-gray-400 dark:text-gray-500'}`}>
                        {isUnlimited ? t('usage_unlimited') : `${percentage}%`}
                    </span>
                </div>
            </div>
            <div className="relative h-2.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden border border-gray-200/50 dark:border-white/5 shadow-inner">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isUnlimited ? '100%' : `${percentage}%` }}
                    transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                    className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${color} transition-all duration-300 ${isUnlimited ? 'opacity-20' : ''}`}
                    style={{
                        boxShadow: (isUnlimited || percentage > 5) ? `0 0 20px ${glowColor}` : 'none'
                    }}
                >
                    {/* Liquid Wave Effect */}
                    <motion.div
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 opacity-30 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] skew-x-12"
                    />
                    {/* Secondary Glow Pulse */}
                    <div className={`absolute inset-0 bg-white/20 animate-pulse ${percentage < 100 ? 'rounded-r-none' : ''}`} />
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
            <div className="p-8 space-y-8 animate-pulse bg-white/5 rounded-3xl border border-white/5">
                <div className="h-4 bg-white/10 rounded-full w-1/3"></div>
                <div className="space-y-6">
                    <div className="space-y-2"><div className="h-2 bg-white/10 rounded-full w-1/4"></div><div className="h-3 bg-white/10 rounded-full"></div></div>
                    <div className="space-y-2"><div className="h-2 bg-white/10 rounded-full w-1/4"></div><div className="h-3 bg-white/10 rounded-full"></div></div>
                    <div className="space-y-2"><div className="h-2 bg-white/10 rounded-full w-1/4"></div><div className="h-3 bg-white/10 rounded-full"></div></div>
                </div>
            </div>
        );
    }

    if (!plan || usageData.length === 0) {
        return (
            <div className={`relative overflow-hidden ${compact ? '' : 'p-8 bg-gray-900 border border-white/10 rounded-3xl shadow-2xl'}`}>
                <div className="relative z-10 flex flex-col items-center text-center py-6">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10 shadow-xl">
                        <TrendingUp className="w-8 h-8 text-primary-500 animate-pulse" />
                    </div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">{t('usage_init_title')}</h4>
                    <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed mb-6">{t('usage_init_desc')}</p>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-1/2 h-full bg-primary-500/50 blur-[2px]"
                        />
                    </div>
                </div>
            </div>
        );
    }

    const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string, glow: string }> = {
        'sms': { icon: Send, color: "from-primary-400 to-primary-600", glow: "rgba(34, 197, 94, 0.4)" },
        'ai_chat': { icon: MessageSquare, color: "from-blue-400 to-indigo-600", glow: "rgba(59, 130, 246, 0.4)" },
        'report': { icon: FileText, color: "from-purple-400 to-fuchsia-600", glow: "rgba(168, 85, 247, 0.4)" }
    };

    return (
        <div className={`relative overflow-hidden transition-all duration-500 ${compact ? '' : 'p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 shadow-2xl group'}`} style={{ borderRadius: compact ? '0' : 'var(--radius-card)' }}>
            {!compact && (
                <>
                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-[80px] -translate-y-24 translate-x-24 group-hover:bg-primary-500/10 transition-colors duration-700" aria-hidden="true" />

                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary-500/10 rounded-xl border border-primary-500/20 shadow-lg shadow-primary-500/5">
                                <TrendingUp className="w-4 h-4 text-primary-500" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">
                                    {t('billing_quota_usage')}
                                </h4>
                                <p className="text-[10px] font-black text-gray-400/60 uppercase tracking-widest">{t('usage_realtime_telemetry')}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="px-3 py-1.5 rounded-full bg-gray-900 dark:bg-white text-[10px] font-black text-white dark:text-gray-900 uppercase tracking-widest shadow-xl">
                                {plan.name}
                            </span>
                        </div>
                    </div>
                </>
            )}

            <div className={`grid gap-10 ${compact ? 'space-y-4' : 'grid-cols-1'}`}>
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
                const smsUsage = usageData.find((u: { type: string; current: number; limit: number }) => u.type === 'sms');
                if (!compact && smsUsage && smsUsage.limit > 0 && smsUsage.current / smsUsage.limit > 0.9) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-10 p-5 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start gap-4 backdrop-blur-md relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
                            <div className="relative z-10 shrink-0 p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="relative z-10">
                                <h5 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-1">{t('usage_critical_threshold')}</h5>
                                <p className="text-xs text-red-600 dark:text-red-400/80 leading-relaxed font-bold">
                                    {t('billing_limit_warning')}
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
