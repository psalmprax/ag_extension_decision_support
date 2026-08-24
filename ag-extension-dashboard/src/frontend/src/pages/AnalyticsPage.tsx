import React from 'react';
import {
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
  MessageSquare,
  BarChart3,
  Radio,
  Zap,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { chartTick } from '@/components/charts/chartConfig';
import { MarketPriceTrendCard } from '@/components/MarketPriceTrendCard';

interface AnalyticsPageProps {
  performanceData:
    | {
        metrics?: {
          resolutionRate?: number;
          avgResponseTime?: string | number;
          satisfactionScore?: number;
          followUpRate?: number;
          firstContactResolution?: number;
        };
        timeline?: Array<Record<string, string | number>>;
      }
    | undefined;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ performanceData }) => {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Top Bento Banner: Analytics & Velocity Hub ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">System Analytics</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Real-time Telemetry Ingestion
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Throughput diagnostics, AI copilot advisory resolution velocities, and regional activity heat.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              SLO: <strong className="text-white">99.8%</strong>
            </span>
          </div>
        </div>
      </div>

      {performanceData ? (
        <>
          {/* ── KPI Stat Bento Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Resolution Rate */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-bold text-emerald-400 uppercase tracking-wider">
                  {t('analytics_resolution_rate') || 'Resolution Rate'}
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-white tracking-tight font-mono">
                  {performanceData?.metrics?.resolutionRate ?? '—'}%
                </p>
                <p className="text-xxs text-white/40 mt-1">Target baseline: &gt;85%</p>
              </div>
            </div>

            {/* 2. Avg Response Time */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-sky-500/20 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-bold text-sky-400 uppercase tracking-wider">
                  {t('analytics_avg_response_time') || 'Avg Response Time'}
                </span>
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-white tracking-tight font-mono">
                  {performanceData?.metrics?.avgResponseTime ?? '—'}
                </p>
                <p className="text-xxs text-white/40 mt-1">Real-time edge response</p>
              </div>
            </div>

            {/* 3. Satisfaction Score */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-teal-500/20 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-bold text-teal-400 uppercase tracking-wider">
                  {t('analytics_satisfaction_score') || 'Satisfaction Score'}
                </span>
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-white tracking-tight font-mono">
                  {performanceData?.metrics?.satisfactionScore ?? '—'}
                </p>
                <p className="text-xxs text-white/40 mt-1">CSAT index (scale 1–5)</p>
              </div>
            </div>

            {/* 4. Follow-Up Rate */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-bold text-amber-400 uppercase tracking-wider">
                  {t('analytics_follow_up_rate') || 'Follow-Up Rate'}
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-white tracking-tight font-mono">
                  {performanceData?.metrics?.followUpRate ?? '—'}%
                </p>
                <p className="text-xxs text-white/40 mt-1">Requires field visit dispatch</p>
              </div>
            </div>

            {/* 5. First Contact Resolution */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-purple-500/20 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-bold text-purple-400 uppercase tracking-wider">
                  {t('analytics_first_contact_res') || 'First Contact Res'}
                </span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-white tracking-tight font-mono">
                  {performanceData?.metrics?.firstContactResolution ?? '—'}%
                </p>
                <p className="text-xxs text-white/40 mt-1">Autonomous 1-turn resolution</p>
              </div>
            </div>
          </div>

          {/* ── Market Prices Full-Width Trend Card ── */}
          <MarketPriceTrendCard />

          {/* ── Activity Timeline Chart Card ── */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  {t('analytics_activity_timeline') || 'Activity & Advisory Timeline'}
                </h3>
                <p className="text-xs text-white/50">
                  Composite volume of scheduled on-site visits vs. conversational USSD/SMS queries.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-white/70">Field Visits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <span className="text-white/70">USSD / SMS Queries</span>
                </div>
              </div>
            </div>

            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData?.timeline || []}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} />
                  <YAxis axisLine={false} tickLine={false} tick={chartTick} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVisits)"
                  />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorQueries)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-2xl p-8">
          <BarChart3 className="w-14 h-14 text-white/20 mb-4" />
          <h3 className="text-base font-bold text-white mb-2">
            {t('analytics_no_data') || 'No Analytics Data Available'}
          </h3>
          <p className="text-xs text-white/50 max-w-sm leading-relaxed">
            {t('analytics_no_data_desc') ||
              'Analytics data will appear here once telemetry activity streams begin. Ensure background sync and advisory workers are running.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
