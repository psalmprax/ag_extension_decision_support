import React, { useState, useEffect } from 'react';
import {
    Activity, CheckCircle, AlertTriangle, XCircle,
    RotateCcw, Clock, RefreshCw, Shield,
    Server, Database, Zap, Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';
import { fetchHealthStatus, fetchRecoveryLog, triggerRecovery, HealthCheck, RecoveryAction } from '../api/systemHealthService';
import toast from 'react-hot-toast';

export function SystemHealth() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useDesignSystemMode();
    const { addNotification } = useAppStore();

    // State
    const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
    const [recoveryLog, setRecoveryLog] = useState<RecoveryAction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [triggeringRecovery, setTriggeringRecovery] = useState<string | null>(null);

    // Load data
    const loadData = async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const [healthRes, recoveryRes] = await Promise.all([
                fetchHealthStatus(),
                fetchRecoveryLog()
            ]);

            if (healthRes.success) {
                setHealthChecks(healthRes.data);
            }
            if (recoveryRes.success) {
                setRecoveryLog(recoveryRes.data);
            }
        } catch (error) {
            console.error('Failed to load health data:', error);
            addNotification({
                type: 'error',
                message: t('system_health_failed_load')
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        // Auto-refresh every 60 seconds
        const interval = setInterval(() => loadData(), 60000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        loadData(true);
    };

    const handleTriggerRecovery = async (component: string) => {
        setTriggeringRecovery(component);
        try {
            const res = await triggerRecovery(component);
            if (res.success) {
                addNotification({
                    type: 'success',
                    message: `Recovery triggered for ${component}`
                });
                // Reload data after a short delay
                setTimeout(() => loadData(), 2000);
            }
        } catch (error) {
            console.error('Failed to trigger recovery:', error);
            addNotification({
                type: 'error',
                message: `Failed to trigger recovery for ${component}`
            });
        } finally {
            setTriggeringRecovery(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            case 'degraded': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
            case 'unhealthy': return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'offline': return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
            default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return CheckCircle;
            case 'degraded': return AlertTriangle;
            case 'unhealthy': return XCircle;
            case 'offline': return XCircle;
            default: return Clock;
        }
    };

    const getComponentIcon = (component: string) => {
        if (component.toLowerCase().includes('database')) return Database;
        if (component.toLowerCase().includes('redis') || component.toLowerCase().includes('cache')) return Zap;
        if (component.toLowerCase().includes('network') || component.toLowerCase().includes('api')) return Wifi;
        return Server;
    };

    const overallHealth = healthChecks.length > 0 ? {
        healthy: healthChecks.filter(h => h.status === 'healthy').length,
        degraded: healthChecks.filter(h => h.status === 'degraded').length,
        unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length,
        offline: healthChecks.filter(h => h.status === 'offline').length
    } : { healthy: 0, degraded: 0, unhealthy: 0, offline: 0 };

    const StatCard = ({ title, value, icon: Icon, color = 'blue' }: {
        title: string;
        value: string | number;
        icon: any;
        color?: string;
    }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 border-white/20 hover:scale-[1.02] transition-transform duration-300"
            style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-premium)' }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/30 ${radiusClass}`}>
                    <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
                </div>
            </div>
        </motion.div>
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Self-Healing Monitor</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor system health and automatic recovery</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-6 animate-pulse">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                                </div>
                                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Infrastructure Vitality' : 'System Health'}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('system_health_subtitle')}</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Overall Health Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title={t('system_health_healthy_components')}
                        value={overallHealth.healthy}
                        icon={CheckCircle}
                        color="green"
                    />
                    <StatCard
                        title={t('system_health_degraded')}
                        value={overallHealth.degraded}
                        icon={AlertTriangle}
                        color="yellow"
                    />
                    <StatCard
                        title={t('system_health_unhealthy')}
                        value={overallHealth.unhealthy}
                        icon={XCircle}
                        color="red"
                    />
                    <StatCard
                        title={t('system_health_offline')}
                        value={overallHealth.offline}
                        icon={XCircle}
                        color="gray"
                    />
            </div>

            {/* Component Health Grid */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('system_health_component_status')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {healthChecks.map((check) => {
                        const StatusIcon = getStatusIcon(check.status);
                        const ComponentIcon = getComponentIcon(check.component);
                        const canRecover = check.status !== 'healthy' && check.consecutiveFailures > 0;

                        return (
                            <motion.div
                                key={check.component}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`p-6 border-2 ${radiusClass} bg-white dark:bg-gray-800 ${getStatusColor(check.status)}`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <ComponentIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                                        <div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white">{check.component}</h4>
                                            <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(check.status)}`}>
                                                <StatusIcon className="w-4 h-4" />
                                                {check.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Last Check</span>
                                        <span className="font-medium">{new Date(check.lastCheck).toLocaleString()}</span>
                                    </div>

                                    {check.lastSuccess && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Last Success</span>
                                            <span className="font-medium">{new Date(check.lastSuccess).toLocaleString()}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Consecutive Failures</span>
                                        <span className="font-medium">{check.consecutiveFailures}</span>
                                    </div>

                                    {check.error && (
                                        <div className={`mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${radiusClass}`}>
                                            <p className="text-sm text-red-700 dark:text-red-300 font-medium">Error:</p>
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{check.error}</p>
                                        </div>
                                    )}

                                    {canRecover && (
                                        <button
                                            onClick={() => handleTriggerRecovery(check.component)}
                                            disabled={triggeringRecovery === check.component}
                                            className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50 text-sm`}
                                        >
                                            <RotateCcw className={`w-4 h-4 ${triggeringRecovery === check.component ? 'animate-spin' : ''}`} />
                                            {t('system_health_trigger_recovery')}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Recovery Log */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('system_health_recovery_log')}</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recoveryLog.slice(0, 20).map((action, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}
                        >
                            <div className="flex items-center gap-4">
                                <Shield className={`w-5 h-5 ${action.success ? 'text-green-600' : 'text-red-600'}`} />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {action.component}: {action.action}
                                    </p>
                                    {action.details && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{action.details}</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    action.success
                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                }`}>
                                    {action.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {action.success ? t('system_health_success') : t('system_health_failed')}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {new Date(action.triggeredAt).toLocaleString()}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default SystemHealth;