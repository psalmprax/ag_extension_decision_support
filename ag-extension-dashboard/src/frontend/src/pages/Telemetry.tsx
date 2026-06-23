import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity, Clock, AlertTriangle, DollarSign,
    RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { fetchTelemetrySummary, fetchTelemetryEvents, TelemetrySummary, TelemetryEvent } from '../api/telemetryService';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { MetricCard } from '@/components/MetricCard';
import { CH_COLORS } from '@/lib/colors';

export function Telemetry() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
    const { addNotification } = useAppStore();

    // State
    const [summary, setSummary] = useState<TelemetrySummary | null>(null);
    const [events, setEvents] = useState<TelemetryEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState(24);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Load data
    const loadData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const [summaryRes, eventsRes] = await Promise.all([
                fetchTelemetrySummary(timeRange),
                fetchTelemetryEvents(100)
            ]);

            if (summaryRes.success) {
                setSummary(summaryRes.data);
            }
            if (eventsRes.success) {
                setEvents(eventsRes.data);
            }
        } catch (error) {
            console.error('Failed to load telemetry data:', error);
            addNotification({
                type: 'error',
                message: t('telemetry_failed_load')
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [timeRange, addNotification, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => {
        loadData(true);
    };

    const filteredEvents = events.filter(event =>
        filterStatus === 'all' || event.status === filterStatus
    );

    const statusStats = {
        success: events.filter(e => e.status === 'success').length,
        error: events.filter(e => e.status === 'error').length,
        pending: events.filter(e => e.status === 'pending').length
    };


    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Telemetry Dashboard</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor AI agent performance and usage</p>
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
                    <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Neural Telemetry' : 'System Telemetry'}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('telemetry_subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(Number(e.target.value))}
                        className={`px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${radiusClass} text-sm`}
                    >
                        <option value={1}>Last Hour</option>
                        <option value={24}>Last 24 Hours</option>
                        <option value={168}>Last 7 Days</option>
                        <option value={720}>Last 30 Days</option>
                    </select>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        title={t('telemetry_total_requests')}
                        value={summary.totalRequests.toLocaleString()}
                        icon={Activity}
                        color="blue"
                    />
                    <MetricCard
                        title={t('telemetry_avg_response_time')}
                        value={`${summary.avgResponseTimeMs.toFixed(0)}ms`}
                        icon={Clock}
                        color="green"
                    />
                    <MetricCard
                        title={t('telemetry_error_rate')}
                        value={`${(summary.errorRate * 100).toFixed(1)}%`}
                        icon={AlertTriangle}
                        color="red"
                    />
                    <MetricCard
                        title={t('telemetry_total_cost')}
                        value={`$${summary.totalCostUsd.toFixed(2)}`}
                        icon={DollarSign}
                        color="purple"
                    />
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('telemetry_request_distribution')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: t('telemetry_success'), value: statusStats.success, color: CH_COLORS.success },
                            { name: t('telemetry_error'), value: statusStats.error, color: CH_COLORS.error },
                            { name: t('telemetry_pending'), value: statusStats.pending, color: CH_COLORS.warning }
                        ]}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill={CH_COLORS.blue} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Agent Usage */}
                {summary?.agentUsage && (
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('telemetry_agent_usage')}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Object.entries(summary.agentUsage).map(([agent, count]) => ({
                                name: agent,
                                usage: count
                            }))}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="usage" fill={CH_COLORS.purple} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Recent Events */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('telemetry_recent_events')}</h3>
                    <div className="flex items-center gap-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className={`px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${radiusClass} text-sm`}
                        >
                            <option value="all">All Status</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredEvents.slice(0, 20).map((event) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full ${
                                    event.status === 'success' ? 'bg-green-500' :
                                    event.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                }`} />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{event.eventType}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {event.agentId && `Agent: ${event.agentId}`}
                                        {event.toolName && ` • Tool: ${event.toolName}`}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(event.timestamp).toLocaleString()}
                                </p>
                                {event.durationMs && (
                                    <p className="text-xs text-gray-500">{event.durationMs}ms</p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Telemetry;