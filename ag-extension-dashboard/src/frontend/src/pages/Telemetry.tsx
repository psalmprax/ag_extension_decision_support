import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import {
  fetchTelemetrySummary,
  fetchTelemetryEvents,
  TelemetrySummary,
  TelemetryEvent,
} from '../api/telemetryService';


import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';
import { TelemetryBreakdowns, TelemetryStatTiles } from './telemetry/TelemetryPanels';
import { SoilNutrientHeatmapCanvas } from '@/components/canvas-ui/SoilNutrientHeatmapCanvas';

function Telemetry() {
  const { t } = useLanguage();
  const { headingClass, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();

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
          <h1 className={`text-2xl font-medium tracking-tight text-slate-900 dark:text-white ${headingClass}`}>{t('nav_telemetry')}</h1>
          <p className="text-slate-600 dark:text-white/60 text-xs sm:text-sm mt-1">{t('telemetry_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={timeRange}
            onChange={e => setTimeRange(Number(e.target.value))}
            className={`px-3 py-2 bg-white dark:bg-theme-bg-secondary border border-slate-200 dark:border-white/10 ${radiusClass} text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-400`}
          >
            <option value={1}>{t('ui_telemetry_last_hour')}</option>
            <option value={24}>{t('ui_telemetry_last_24_hours')}</option>
            <option value={168}>{t('ui_telemetry_last_7_days')}</option>
            <option value={720}>{t('ui_telemetry_last_30_days')}</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50 text-xs sm:text-sm font-medium transition-all shadow-md`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t('ui_farmer_detail_panel_refresh')}</span>
          </button>
        </div>
      </div>

      {summary && <TelemetryStatTiles summary={summary} events={events} />}

      {/* Interactive Spatial Soil & Telemetry Canvas View */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span>{t('ui_telemetry_spatial_soil_environmental_telemetry')}</span>
              <span className="px-2 py-0.5 rounded text-xxs font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {t('ui_telemetry_soilgrids_v2_nasa_power')}
              </span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-theme-text-muted mt-1">
              {t('ui_telemetry_hardware_accelerated_2d_idw_interpol')}
            </p>
          </div>
        </div>
        <SoilNutrientHeatmapCanvas initialLayer="ph" />
      </div>

      <TelemetryBreakdowns summary={summary} events={events} />

      {/* Recent Events */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('telemetry_recent_events')}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className={`px-3 py-2 bg-white dark:bg-theme-bg-tertiary border border-gray-200 dark:border-white/[0.12] ${radiusClass} text-sm`}
            >
              <option value="all">{t('ui_telemetry_all_status')}</option>
              <option value="success">{t('common_success')}</option>
              <option value="error">{t('common_error')}</option>
              <option value="pending">{t('telemetry_pending')}</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredEvents.slice(0, 20).map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-theme-bg-tertiary/50 ${radiusClass}`}
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
                  <p className="text-sm text-gray-600 dark:text-theme-text-muted">
                    {event.agentId && `Agent: ${event.agentId}`}
                    {event.toolName && ` • Tool: ${event.toolName}`}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-sm text-gray-600 dark:text-theme-text-muted">
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
