import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, AlertTriangle, DollarSign, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { useDemoMode } from '@/demo';
import {
  fetchTelemetrySummary,
  fetchTelemetryEvents,
  TelemetrySummary,
  TelemetryEvent,
} from '../api/telemetryService';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { MetricCard } from '@/components/MetricCard';
import { CH_COLORS } from '@/lib/colors';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { chartGrid, chartTick } from '@/components/charts/chartConfig';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';
import { SoilNutrientHeatmapCanvas } from '@/components/canvas-ui/SoilNutrientHeatmapCanvas';
import { LiveSparklineCanvas } from '@/components/canvas-ui/LiveSparklineCanvas';

export function Telemetry() {
  const { t } = useLanguage();
  const { headingClass, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();
  const { isDemo } = useDemoMode();

  // State
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState(24);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Load data
  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const [summaryRes, eventsRes] = await Promise.all([
          fetchTelemetrySummary(timeRange),
          fetchTelemetryEvents(100),
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
          message: t('telemetry_failed_load'),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [timeRange, addNotification, t]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const filteredEvents = events.filter(
    event => filterStatus === 'all' || event.status === filterStatus
  );

  const statusStats = {
    success: events.filter(e => e.status === 'success').length,
    error: events.filter(e => e.status === 'error').length,
    pending: events.filter(e => e.status === 'pending').length,
  };

  const statusData = [
    { name: t('telemetry_success'), value: statusStats.success, color: CH_COLORS.success },
    { name: t('telemetry_error'), value: statusStats.error, color: CH_COLORS.error },
    { name: t('telemetry_pending'), value: statusStats.pending, color: CH_COLORS.warning },
  ];

  if (isLoading) {
    return (
      <LoadingHeaderSkeleton
        title="Agent Telemetry Dashboard"
        description="Monitor AI agent performance and usage"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight text-white ${headingClass}`}>System Telemetry</h1>
          <p className="text-white/60 text-xs sm:text-sm mt-1">{t('telemetry_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={timeRange}
            onChange={e => setTimeRange(Number(e.target.value))}
            className={`px-3 py-2 bg-slate-900 border border-white/10 ${radiusClass} text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-400`}
          >
            <option value={1}>Last Hour</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last 7 Days</option>
            <option value={720}>Last 30 Days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50 text-xs sm:text-sm font-bold transition-all shadow-md`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards with Live Sparklines */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card p-5 relative overflow-hidden flex flex-col justify-between">
            <MetricCard
              title={t('telemetry_total_requests')}
              value={summary.totalRequests.toLocaleString()}
              icon={Activity}
              color="blue"
            />
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              {isDemo ? (
                <LiveSparklineCanvas
                  data={[12, 19, 15, 27, 24, 32, 28, 41, 38, (summary.totalRequests % 50) + 20]}
                  color="#0284c7"
                  fillColor="rgba(2, 132, 199, 0.12)"
                  height={28}
                />
              ) : (
                <div className="h-[28px] flex items-center text-[10px] font-mono text-slate-400">Live count — sparkline history available in demo account</div>
              )}
            </div>
          </div>

          <div className="card p-5 relative overflow-hidden flex flex-col justify-between">
            <MetricCard
              title={t('telemetry_avg_response_time')}
              value={`${summary.avgResponseTimeMs.toFixed(0)}ms`}
              icon={Clock}
              color="green"
            />
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              {isDemo ? (
                <LiveSparklineCanvas
                  data={[
                    340,
                    290,
                    310,
                    280,
                    260,
                    240,
                    250,
                    230,
                    210,
                    summary.avgResponseTimeMs || 220,
                  ]}
                  color="#10b981"
                  fillColor="rgba(16, 185, 129, 0.12)"
                  height={28}
                />
              ) : (
                <div className="h-[28px] flex items-center text-[10px] font-mono text-slate-400">Live latency — history in demo</div>
              )}
            </div>
          </div>

          <div className="card p-5 relative overflow-hidden flex flex-col justify-between">
            <MetricCard
              title={t('telemetry_error_rate')}
              value={`${(summary.errorRate * 100).toFixed(1)}%`}
              icon={AlertTriangle}
              color="red"
            />
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              {isDemo ? (
                <LiveSparklineCanvas
                  data={[4.2, 3.8, 5.1, 2.9, 3.2, 2.1, 1.8, 1.2, 0.9, summary.errorRate * 100]}
                  color="#ef4444"
                  fillColor="rgba(239, 68, 68, 0.12)"
                  height={28}
                />
              ) : (
                <div className="h-[28px] flex items-center text-[10px] font-mono text-slate-400">Live error rate — history in demo</div>
              )}
            </div>
          </div>

          <div className="card p-5 relative overflow-hidden flex flex-col justify-between">
            <MetricCard
              title={t('telemetry_total_cost')}
              value={`$${summary.totalCostUsd.toFixed(2)}`}
              icon={DollarSign}
              color="purple"
            />
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              {isDemo ? (
                <LiveSparklineCanvas
                  data={[0.4, 0.8, 1.1, 1.7, 2.3, 3.1, 3.8, 4.4, 5.1, summary.totalCostUsd]}
                  color="#a855f7"
                  fillColor="rgba(168, 85, 247, 0.12)"
                  height={28}
                />
              ) : (
                <div className="h-[28px] flex items-center text-[10px] font-mono text-slate-400">Live cost — history in demo</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Spatial Soil & Telemetry Canvas View */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Spatial Soil & Environmental Telemetry Interpolator</span>
              <span className="px-2 py-0.5 rounded text-xxs font-mono uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                SoilGrids v2 + NASA POWER
              </span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Hardware-accelerated 2D IDW interpolation mesh for sub-surface acidity, NPK, moisture
              saturation, and SOC.
            </p>
          </div>
        </div>
        <SoilNutrientHeatmapCanvas initialLayer="ph" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('telemetry_request_distribution')}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTick} />
              <YAxis axisLine={false} tickLine={false} tick={chartTick} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Usage */}
        {summary?.agentUsage && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('telemetry_agent_usage')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(summary.agentUsage).map(([agent, count]) => ({
                  name: agent,
                  usage: count,
                }))}
              >
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTick} />
                <YAxis axisLine={false} tickLine={false} tick={chartTick} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="usage" fill={CH_COLORS.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('telemetry_recent_events')}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
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
          {filteredEvents.slice(0, 20).map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    event.status === 'success'
                      ? 'bg-green-500'
                      : event.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                  }`}
                />
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
                {event.durationMs && <p className="text-xs text-gray-500">{event.durationMs}ms</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Telemetry;
