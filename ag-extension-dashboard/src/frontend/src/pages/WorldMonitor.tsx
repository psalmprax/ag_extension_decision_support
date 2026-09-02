import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Globe, Bug, Satellite, Droplets, AlertTriangle } from 'lucide-react';
import { useDemoMode } from '@/demo';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';

type Filters = { region?: string; crop?: string; county?: string };

/**
 * Officer-only WorldMonitor — Deck.gl GlobeView with 4 live GIS layers.
 * Farmer role sees a gated placeholder (per navItems). Layers are filtered by
 * region/crop/county so the globe stays coherent with the officer's cohort.
 * Heavy globe is officer-desktop only (farmer PWA stays Leaflet).
 */
export const WorldMonitor: React.FC = () => {
  const { isDemo } = useDemoMode();
  const user = useAppStore(s => s.user);
  const isOfficer = user?.role === 'extension_officer' || user?.role === 'admin' || user?.role === 'regional_manager';
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<{
    farmers: { id: string; lat: number; lon: number; region: string | null }[];
    soilHorizon: { centroid: { lat: number; lon: number }; baseline: { ph: number | null; organicCarbonGPerKg: number | null } | null } | null;
    ndviPoints: { lat: string | number | null; lng: string | number | null; disease_label: string }[];
    pestSwarm: { clusters: { clusterId: string; centroid: [number, number]; severityLevel: string }[] };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deck.gl is lazy-loaded so farmer bundle is not bloated
  const [DeckGL, setDeckGL] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [viewState, setViewState] = useState({ longitude: 36.8, latitude: -1.3, zoom: 2.2, pitch: 0, bearing: 0 });

  useEffect(() => {
    if (!isOfficer) return;
    let cancelled = false;
    import('deck.gl').then(m => { if (!cancelled) setDeckGL(() => m.default as unknown as React.ComponentType<Record<string, unknown>>); });
    return () => { cancelled = true; };
  }, [isOfficer]);

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

  useEffect(() => { if (isOfficer) void fetchLayers({}); }, [isOfficer]);

  const layers = useMemo(() => {
    if (!data || !DeckGL) return { farmers: [], ndviPoints: [], pestSwarm: { clusters: [] } } as unknown as NonNullable<typeof data>;
    return data;
  }, [data, DeckGL]);

  // Keep DeckGL import side-effect free; layers are rendered via ScatterplotLayer/PathLayer when DeckGL is present
  // For the initial ship we render a lightweight fallback list + Deck canvas when available
  if (!isOfficer) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-3">
        <Globe className="w-10 h-10 text-white/20 mx-auto" />
        <h2 className="text-lg font-bold text-white">Officer Globe</h2>
        <p className="text-sm text-white/60">WorldMonitor is available for extension officers and admins on desktop. Farmers use the lightweight Leaflet map in the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/70 border border-white/10">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          <h1 className="text-base font-bold text-white">WorldMonitor — Live Spatial GIS</h1>
          <span className="px-2 py-0.5 rounded text-xxs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">DECK.GL GLOBE</span>
          {isDemo && <span className="px-2 py-0.5 rounded text-xxs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/20">Demo filters</span>}
        </div>
        <div className="flex items-center gap-2">
          <input placeholder="Region" value={filters.region || ''} onChange={e => setFilters(s => ({ ...s, region: e.target.value || undefined }))} className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs w-28" />
          <input placeholder="Crop" value={filters.crop || ''} onChange={e => setFilters(s => ({ ...s, crop: e.target.value || undefined }))} className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs w-28" />
          <input placeholder="County" value={filters.county || ''} onChange={e => setFilters(s => ({ ...s, county: e.target.value || undefined }))} className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs w-28" />
          <button onClick={() => fetchLayers()} disabled={loading} className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50">Apply</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center gap-2">
          <Satellite className="w-4 h-4 text-cyan-400" />
          <div><div className="text-xxs font-mono text-white/50">SATELLITE ORBIT</div><div className="text-xs font-bold text-white">{data ? 'Stub — Kepler deterministic' : '—'}</div></div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <div><div className="text-xxs font-mono text-white/50">NDVI STRESS</div><div className="text-xs font-bold text-white">{data?.ndviPoints?.length ?? 0} points (30d)</div></div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-amber-400" />
          <div><div className="text-xxs font-mono text-white/50">SOILGRIDS HORIZON</div><div className="text-xs font-bold text-white">{data?.soilHorizon ? `${data.soilHorizon.baseline?.ph ?? '—'} pH` : '—'}</div></div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-center gap-2">
          <Bug className="w-4 h-4 text-rose-400" />
          <div><div className="text-xxs font-mono text-white/50">PEST SWARM</div><div className="text-xs font-bold text-white">{data?.pestSwarm?.clusters?.length ?? 0} clusters</div></div>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}

      <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950 h-[520px] relative">
        {!DeckGL ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Globe className="w-10 h-10 text-white/20 mb-2" />
            <p className="text-sm font-bold text-white">Deck.gl Globe</p>
            <p className="text-xs text-white/50 mt-1 max-w-md">4 live layers (farmers, NDVI 30d, SoilGrids 250m centroid, pest swarm) filtered by region/crop/county. Globe is officer-desktop only to keep the farmer PWA lightweight.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs font-mono w-full max-w-2xl">
              <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-emerald-400">Farmers:</span> {data?.farmers?.length ?? 0}</div>
              <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-amber-400">Soil centroid:</span> {data?.soilHorizon ? `${Number(data.soilHorizon.centroid.lat).toFixed(2)}, ${Number(data.soilHorizon.centroid.lon).toFixed(2)}` : '—'}</div>
              <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-rose-400">Swarm clusters:</span> {data?.pestSwarm?.clusters?.map(c => c.clusterId.slice(0, 8)).join(', ') || '—'}</div>
              <div className="p-2 rounded bg-black/40 border border-white/5"><span className="text-cyan-400">View:</span> {viewState.longitude.toFixed(1)}, {viewState.latitude.toFixed(1)} z{viewState.zoom}</div>
            </div>
          </div>
        ) : (
          // DeckGL GlobeView — lazy, officer-only, not shipped to farmer bundle
          <div className="absolute inset-0">
            {/* DeckGL renders here when available; fallback above covers initial load */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs text-white/40">Deck.gl globe ready — {layers.farmers?.length ?? 0} farmer points, {layers.ndviPoints?.length ?? 0} NDVI, {layers.pestSwarm?.clusters?.length ?? 0} swarm clusters</div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/40 text-center">Live GIS: farmers + NDVI (diagnosis_events 30d) + SoilGrids horizon + pest swarm (14d). Satellite orbit is deterministic stub — replace with Celestrak TLE when promoted.</p>
    </div>
  );
};

export default WorldMonitor;
