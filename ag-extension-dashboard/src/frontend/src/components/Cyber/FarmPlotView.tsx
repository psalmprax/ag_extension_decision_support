import React, { useEffect, useMemo, useState } from 'react';
import { appLocale } from '@/lib/appLocale';
import apiClient from '@/api/client';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { ThreeViewport } from '@/components/three/ThreeViewport';
import { useThreeScene, type SceneFactory } from '@/components/three/useThreeScene';
import type { FarmPlotParams } from '@/components/three/scenes/farmPlotScene';
import { useUnits } from '@/hooks/useUnits';

interface FarmPlotViewProps {
  farmSize?: number;
  crops?: string[];
  farmerId?: string;
}

interface SatelliteReading {
  ndvi?: number;
  soilMoisture?: number;
  lastUpdated?: string;
}

const loadPlot = () => import('@/components/three/scenes/farmPlotScene').then(m => m.createFarmPlotScene as unknown as SceneFactory<FarmPlotParams>);

/**
 * The farmer's plot in 3D. With a satellite reading the canopy is coloured by its NDVI and
 * the reading is shown; without one the plot stays a neutral green and says so.
 */
const FarmPlotView: React.FC<FarmPlotViewProps> = ({ farmSize: givenSize = 0, crops = [], farmerId }) => {
  const { t } = useLanguage();
  const units = useUnits();
  const dark = useAppStore(state => state.darkMode);
  const [reading, setReading] = useState<SatelliteReading | null>(null);
  const [farmSize, setFarmSize] = useState(givenSize);

  useEffect(() => {
    if (!farmerId) return;
    apiClient
      .get(`/external/satellite/${farmerId}`)
      .then(res => {
        const data = res.data?.success ? res.data.data : null;
        setReading(data ? { ndvi: data.ndvi, soilMoisture: data.soilMoisture, lastUpdated: data.timestamp } : null);
        if (data?.farmSize) setFarmSize(data.farmSize);
      })
      .catch(() => setReading(null));
  }, [farmerId]);

  const lines = useMemo(() => {
    const out = [`${crops[0] ?? t('farm_plot_farm', { defaultValue: 'Farm' })}${farmSize > 0 ? `, ${units.area(farmSize)}` : ''}`];
    if (reading?.ndvi !== undefined) out.push(`NDVI ${reading.ndvi.toFixed(2)}`);
    if (reading?.soilMoisture !== undefined) out.push(t('farm_plot_moisture', { value: reading.soilMoisture.toFixed(1), defaultValue: 'Soil moisture {value}%' }));
    if (reading?.lastUpdated) out.push(t('farm_plot_updated', { date: new Date(reading.lastUpdated).toLocaleDateString(appLocale()), defaultValue: 'Updated {date}' }));
    if (!reading) out.push(t('farm_plot_no_reading', { defaultValue: 'No satellite reading yet' }));
    return out;
  }, [crops, farmSize, reading, t, units]);

  const params = useMemo<FarmPlotParams>(
    () => ({ seed: farmerId ?? 'farm', dark, ndvi: reading?.ndvi ?? null, lines }),
    [farmerId, dark, reading, lines]
  );
  const { containerRef, status } = useThreeScene(loadPlot, params);

  return (
    <ThreeViewport
      containerRef={containerRef}
      status={status}
      label={lines.join('. ')}
      loadingText={t('farm_plot_loading', { defaultValue: 'Loading your plot…' })}
      fallback={<p className="text-sm text-slate-600 dark:text-white/70">{lines.join(' · ')}</p>}
      className="w-full h-96 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-[#eef3f0] dark:bg-theme-bg-primary"
    />
  );
};

export default FarmPlotView;
