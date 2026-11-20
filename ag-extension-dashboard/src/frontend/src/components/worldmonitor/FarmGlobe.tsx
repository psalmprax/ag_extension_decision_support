import React, { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { ThreeViewport } from '@/components/three/ThreeViewport';
import { useThreeScene, type SceneFactory } from '@/components/three/useThreeScene';
import { toCoordinate } from '@/components/three/math';
import type { GlobeMarker, GlobeParams } from '@/components/three/scenes/globeScene';
import { startDistance } from '@/components/three/scenes/globeFocus';

export interface GlobeLayers {
  farmers: Array<{ id: string; lat: number; lon: number; region: string | null; district?: string | null; crops?: string[] | null }>;
  ndviPoints: Array<{ lat: string | number | null; lng: string | number | null; disease_label?: string; crop?: string }>;
  pestSwarm?: { clusters: Array<{ clusterId: string; centroid: [number, number]; severityLevel: string; pestType?: string }> };
  soilHorizon: { centroid: { lat: number; lon: number }; baseline: { ph: number | null } | null } | null;
}

export type LayerToggles = GlobeParams['layers'];

const SEVERITY: Record<string, number> = { low: 1, moderate: 2, medium: 2, high: 3, severe: 3, critical: 3 };
const loadGlobe = () => import('@/components/three/scenes/globeScene').then(m => m.createGlobeScene as unknown as SceneFactory<GlobeParams>);

/** The farms and field signals on a real globe; only records the server returned are drawn. */
export function FarmGlobe({ layers, toggles }: { layers: GlobeLayers | null; toggles: LayerToggles }) {
  const { t } = useLanguage();
  const dark = useAppStore(state => state.darkMode);

  const params = useMemo<GlobeParams>(() => {
    const farmers: GlobeMarker[] = (layers?.farmers ?? []).map(f => ({
      lat: f.lat,
      lon: f.lon,
      lines: [t('globe_farmer', { defaultValue: 'Farmer' }), [f.district, f.region].filter(Boolean).join(', '), (f.crops ?? []).join(', ')].filter(Boolean),
    }));
    const stress: GlobeMarker[] = (layers?.ndviPoints ?? []).flatMap(p => {
      const lat = toCoordinate(p.lat, 90);
      const lon = toCoordinate(p.lng, 180);
      return lat === null || lon === null ? [] : [{ lat, lon, lines: [t('globe_stress', { defaultValue: 'Crop stress report' }), [p.crop, p.disease_label].filter(Boolean).join(': ')] }];
    });
    const pests = (layers?.pestSwarm?.clusters ?? []).map(c => ({
      lat: c.centroid[0],
      lon: c.centroid[1],
      severity: SEVERITY[c.severityLevel?.toLowerCase()] ?? 1,
      lines: [t('globe_pests', { defaultValue: 'Pest reports' }), [c.pestType, c.severityLevel].filter(Boolean).join(', ')],
    }));
    const soil = layers?.soilHorizon
      ? {
          lat: layers.soilHorizon.centroid.lat,
          lon: layers.soilHorizon.centroid.lon,
          lines: [t('globe_soil', { defaultValue: 'Soil sample point' }), layers.soilHorizon.baseline?.ph != null ? `pH ${layers.soilHorizon.baseline.ph}` : ''].filter(Boolean),
        }
      : null;
    // Look first at the middle of the data; East Africa when there is none.
    const points = farmers.length ? farmers : stress;
    const focus = points.length
      ? {
          lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
          lon: points.reduce((s, p) => s + p.lon, 0) / points.length,
          distance: startDistance(points),
        }
      : { lat: -1.3, lon: 36.8, distance: 2.6 };
    return { dark, farmers, stress, pests, soil, focus, layers: toggles };
  }, [layers, toggles, dark, t]);

  const { containerRef, status } = useThreeScene(loadGlobe, params);
  return (
    <ThreeViewport
      containerRef={containerRef}
      status={status}
      label={t('globe_label', { count: params.farmers.length, defaultValue: 'Globe with {count} farms. Drag to turn it, scroll or pinch to zoom.' })}
      loadingText={t('globe_loading', { defaultValue: 'Loading the globe…' })}
      fallback={
        <p className="text-sm text-slate-600 dark:text-white/70 max-w-sm">
          {t('globe_unsupported', { defaultValue: 'This device cannot show the 3D globe. The counts above are the same data.' })}
        </p>
      }
      className="h-[520px] rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-[#f3f6f4] dark:bg-[#0d1a14]"
    />
  );
}
