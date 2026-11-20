import React, { useEffect, useState } from 'react';
import { Globe, Bug, Satellite, Droplets, Layers, AlertTriangle } from 'lucide-react';
import { useDemoMode } from '@/demo';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';
import { pestSwarmLabel, type PestSwarmStatus } from './worldMonitorStatus';
import { useLanguage } from '@/lib/LanguageContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { FarmGlobe, type GlobeLayers, type LayerToggles } from '@/components/worldmonitor/FarmGlobe';
import { LAYER_COLORS } from '@/components/three/scenes/globeColors';

type Filters = { region?: string; crop?: string; county?: string };
type LayerData = GlobeLayers & { pestSwarm: { status?: PestSwarmStatus; clusters: NonNullable<GlobeLayers['pestSwarm']>['clusters'] } };

const FILTER_INPUT =
  'h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full sm:w-36';

/**
 * Farms and field signals on a globe, for officers (their farmers), managers (their region)
 * and administrators. Each layer can be switched off; nothing is drawn that the server did
 * not return.
 */
const WorldMonitor: React.FC = () => {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
  const user = useAppStore(s => s.user);
  const isStaff = user?.role === 'extension_officer' || user?.role === 'admin' || user?.role === 'regional_manager';
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<LayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggles, setToggles] = useState<LayerToggles>({ farmers: true, stress: true, pests: true, soil: true });

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
      else setError(t('map_load_failed', { defaultValue: 'The map layers could not be loaded.' }));
    } catch {
      setError(t('map_load_failed', { defaultValue: 'The map layers could not be loaded.' }));
    } finally {
      setLoading(false);
    }
  };

  // The first load only; later loads come from the Apply button (which reads the filters).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isStaff) void fetchLayers({}); }, [isStaff]);

  if (!isStaff) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-3">
        <Globe className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
        <h2 className="text-lg font-medium text-slate-900 dark:text-white">{t('nav_worldmonitor', { defaultValue: 'Farm map' })}</h2>
        <p className="text-sm text-slate-600 dark:text-white/70">{t('map_staff_only', { defaultValue: 'The farm map is for extension officers and managers.' })}</p>
      </div>
    );
  }

  const farmerCount = data?.farmers.length ?? 0;
  const stressCount = data?.ndviPoints.filter(p => p.lat != null && p.lng != null).length ?? 0;
  const pestCount = data?.pestSwarm?.clusters.length ?? 0;
  const layerList: Array<{ key: keyof LayerToggles; label: string; count: number | null }> = [
    { key: 'farmers', label: t('map_layer_farmers', { defaultValue: 'Farms' }), count: farmerCount },
    { key: 'stress', label: t('map_layer_stress', { defaultValue: 'Crop stress (30 days)' }), count: stressCount },
    { key: 'pests', label: t('map_layer_pests', { defaultValue: 'Pest reports (14 days)' }), count: data?.pestSwarm?.status === 'live' ? pestCount : null },
    { key: 'soil', label: t('map_layer_soil', { defaultValue: 'Soil sample point' }), count: data?.soilHorizon ? 1 : 0 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('map_title', { defaultValue: 'Map of farms and field signals' })}
        description={t('map_description', {
          defaultValue: 'Farms with a saved location, crop stress from recent diagnoses, pest reports and soil data. Drag the globe to turn it.',
        })}
        meta={
          <span aria-live="polite">
            {loading
              ? t('common_loading', { defaultValue: 'Loading…' })
              : farmerCount === 1
                ? t('map_farmer_count_one', { defaultValue: '1 farmer on the map' })
                : t('map_farmers_count', { count: farmerCount, defaultValue: '{count} farmers on the map' })}
            {isDemo && ` · ${t('map_demo', { defaultValue: 'demo data' })}`}
          </span>
        }
      >
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={event => {
            event.preventDefault();
            void fetchLayers();
          }}
        >
          {(['region', 'crop', 'county'] as const).map(key => (
            <label key={key} className="text-sm text-slate-600 dark:text-white/70 flex-1 sm:flex-none">
              {t(`map_filter_${key}`, { defaultValue: key === 'county' ? 'County' : key === 'crop' ? 'Crop' : 'Region' })}
              <input
                value={filters[key] || ''}
                onChange={e => setFilters(s => ({ ...s, [key]: e.target.value || undefined }))}
                className={`${FILTER_INPUT} mt-1 block`}
              />
            </label>
          ))}
          <button type="submit" disabled={loading} className={PRIMARY_BUTTON}>
            {t('map_apply', { defaultValue: 'Apply' })}
          </button>
        </form>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={t('map_tile_farms', { defaultValue: 'Farms mapped' })} icon={Layers} value={data ? farmerCount : null} />
        <StatTile label={t('map_tile_stress', { defaultValue: 'Crop stress reports' })} icon={Droplets} value={data ? stressCount : null} note={t('map_last_30', { defaultValue: 'Last 30 days' })} />
        <StatTile
          label={t('map_tile_soil', { defaultValue: 'Soil pH at sample point' })}
          icon={Satellite}
          value={data?.soilHorizon?.baseline?.ph ?? null}
          emptyText={t('map_no_soil', { defaultValue: 'No soil data yet' })}
          note={data?.soilHorizon?.baseline?.ph != null ? 'SoilGrids, 0–30 cm' : undefined}
        />
        <StatTile
          label={t('map_tile_pests', { defaultValue: 'Pest clusters' })}
          icon={Bug}
          value={data?.pestSwarm?.status === 'live' ? pestCount : null}
          emptyText={data ? pestSwarmLabel(data.pestSwarm) : undefined}
          note={t('map_last_14', { defaultValue: 'Last 14 days' })}
        />
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-rose-50 dark:bg-rose-400/[0.08] border border-rose-600/20 text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_17rem] gap-4">
        <FarmGlobe layers={data} toggles={toggles} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-900 dark:text-white mb-2">{t('map_layers', { defaultValue: 'Layers' })}</legend>
          {layerList.map(layer => (
            <label key={layer.key} className="flex items-center gap-3 h-11 px-3 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] text-sm text-slate-700 dark:text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={toggles[layer.key]}
                onChange={e => setToggles(s => ({ ...s, [layer.key]: e.target.checked }))}
                className="w-4 h-4 accent-emerald-700"
              />
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: LAYER_COLORS[layer.key] }} aria-hidden="true" />
              <span className="flex-1">{layer.label}</span>
              <span className="tabular-nums text-xs text-slate-500 dark:text-white/50 text-right">
                {layer.count === null ? t('map_not_connected', { defaultValue: 'not connected' }) : layer.count}
              </span>
            </label>
          ))}
          <p className="text-xs text-slate-500 dark:text-white/50 pt-1">
            {t('map_note', { defaultValue: 'Add a farmer’s location to put their farm on the map.' })}
          </p>
        </fieldset>
      </div>
    </div>
  );
};

export default WorldMonitor;
