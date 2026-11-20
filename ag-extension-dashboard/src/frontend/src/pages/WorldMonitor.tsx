import React, { useEffect, useState } from 'react';
import { Layers, Globe, Bug, Satellite, Droplets, AlertTriangle } from 'lucide-react';
import { useDemoMode } from '@/demo';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';
import { liveLayersSummary, pestSwarmLabel, type PestSwarmStatus } from './worldMonitorStatus';
import { useLanguage } from '@/lib/LanguageContext';

type Filters = { region?: string; crop?: string; county?: string };

/**
 * Officer-only WorldMonitor — live GIS layer status with 4 live data feeds.
 * Farmer role sees a gated placeholder (per navItems). Layers are filtered by
 * region/crop/county so the feeds stay coherent with the officer's cohort.
 * Heavy globe canvas is intentionally deferred (bundle budget); this page
 * surfaces the live layer data without shipping the deck.gl payload.
 */
const WorldMonitor: React.FC = () => {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
  const user = useAppStore(s => s.user);
  const isOfficer = user?.role === 'extension_officer' || user?.role === 'admin' || user?.role === 'regional_manager';
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<{
    farmers: { id: string; lat: number; lon: number; region: string | null }[];
    soilHorizon: { centroid: { lat: number; lon: number }; baseline: { ph: number | null; organicCarbonGPerKg: number | null } | null } | null;
    ndviPoints: { lat: string | number | null; lng: string | number | null; disease_label: string }[];
    pestSwarm: { status?: PestSwarmStatus; clusters: { clusterId: string; centroid: [number, number]; severityLevel: string }[] };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewState = { longitude: 36.8, latitude: -1.3, zoom: 2.2 };

  const fetchLayers = async (f: Filters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.region) params.set('region', f.region);
      if (f.crop) params.set('crop', f.crop);
      if (f.county) params.set('county', f.county);
      const { data: res } = await apiClient.get(`/worldmonitor/layers?${params.toString()}`);
      if (res?.success) setData(res.data);
      else setError(res?.error || 'Failed to load layers');
    } catch (e) { setError((e as Error).message || 'Failed to load layers'); }
    finally { setLoading(false); }
  };

  // Initial fetch only — subsequent loads are user-triggered via the Apply button,
  // so fetchLayers is intentionally not a dependency (it closes over filter state).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOfficer) void fetchLayers({}); }, [isOfficer]);

  if (!isOfficer) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-3">
        <Globe className="w-10 h-10 text-slate-400 dark:text-white/20 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('ui_world_monitor_officer_globe')}</h2>
        <p className="text-sm text-slate-500 dark:text-white/60">{t('ui_world_monitor_worldmonitor_is_available_for_extens')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-medium text-slate-900 dark:text-white">{t('ui_world_monitor_worldmonitor_live_spatial_gis')}</h1>
          {isDemo && <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">{t('ui_world_monitor_demo_filters')}</span>}
        </div>
        <div className="flex items-center gap-2">
          <input placeholder="Region" value={filters.region || ''} onChange={e => setFilters(s => ({ ...s, region: e.target.value || undefined }))} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs w-28 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600" />
          <input placeholder="Crop" value={filters.crop || ''} onChange={e => setFilters(s => ({ ...s, crop: e.target.value || undefined }))} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs w-28 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600" />
          <input placeholder="County" value={filters.county || ''} onChange={e => setFilters(s => ({ ...s, county: e.target.value || undefined }))} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs w-28 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600" />
          <button onClick={() => fetchLayers()} disabled={loading} className="h-8 px-4 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium disabled:opacity-50 transition-colors">{t('ui_world_monitor_apply')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
          <Satellite className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
          <div><div className="text-xs text-slate-500 dark:text-white/50">{t('ui_world_monitor_satellite_orbit')}</div><div className="text-xs font-medium text-slate-900 dark:text-white">{data ? 'Not connected yet' : '—'}</div></div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div><div className="text-xs text-slate-500 dark:text-white/50">{t('ui_world_monitor_ndvi_stress')}</div><div className="text-xs font-medium font-mono tabular-nums text-slate-900 dark:text-white">{data?.ndviPoints?.length ?? 0} {t('ui_world_monitor_points_30d')}</div></div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
          <Droplets className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div><div className="text-xs text-slate-500 dark:text-white/50">{t('ui_world_monitor_soilgrids_horizon')}</div><div className="text-xs font-medium font-mono tabular-nums text-slate-900 dark:text-white">{data?.soilHorizon ? `${data.soilHorizon.baseline?.ph ?? '—'} pH` : '—'}</div></div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center gap-2.5">
          <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <div><div className="text-xs text-slate-500 dark:text-white/50">{t('ui_world_monitor_pest_swarm')}</div><div className="text-xs font-medium font-mono tabular-nums text-slate-900 dark:text-white">{pestSwarmLabel(data?.pestSwarm)}</div></div>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}

      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-950 h-[520px] relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <Globe className="w-10 h-10 text-white/20 mb-2" />
          <p className="text-sm font-semibold text-white">{t('ui_world_monitor_spatial_layer_status')}</p>
          <p className="text-xs text-white/50 mt-1 max-w-md">{liveLayersSummary(data?.pestSwarm?.status)}{t('ui_world_monitor_filtered_by_region_crop_county_globe')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs font-mono tabular-nums w-full max-w-2xl">
            <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-emerald-400">{t('ui_world_monitor_farmers_mapped')}</span> {data?.farmers?.length ?? 0}</div>
            <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-amber-400">{t('ui_world_monitor_soil_centroid')}</span> {data?.soilHorizon ? `${Number(data.soilHorizon.centroid.lat).toFixed(2)}, ${Number(data.soilHorizon.centroid.lon).toFixed(2)}` : '—'}</div>
            <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-rose-400">{t('ui_world_monitor_swarm_clusters')}</span> {data?.pestSwarm?.clusters?.map(c => c.clusterId.slice(0, 8)).join(', ') || '—'}</div>
            <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-slate-400">{t('ui_world_monitor_view')}</span> {viewState.longitude.toFixed(1)}, {viewState.latitude.toFixed(1)} z{viewState.zoom}</div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-white/40 text-center">{t('ui_world_monitor_shows_farmers_with_a_saved_location')}</p>
    </div>
  );
};

export default WorldMonitor;
