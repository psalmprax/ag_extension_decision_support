import React from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Zap,
  Navigation2,
  Shield,
  Cpu,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useSatelliteData } from './satellite/useSatelliteData';
import type { PriorityLike, FarmerLike } from '@/types/visit';
import { useLanguage } from '@/lib/LanguageContext';

interface Metric {
  label: string;
  value: string;
  status: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface SatelliteInsightsProps {
  farmerId: string;
  isCyber?: boolean;
  metrics?: Metric[];
}

const SpatialDataVisualization = ({
  dataPoints,
  isLoading,
  isCyber,
  priority,
  farmer,
}: {
  dataPoints: Array<Record<string, unknown>>;
  isLoading: boolean;
  isCyber: boolean;
  priority: PriorityLike | null;
  farmer: FarmerLike | null;
}) => {
  const { t } = useLanguage();
  const priorityLevel = priority?.level;
  const isHighOrCritical = priorityLevel === 'critical' || priorityLevel === 'high';
  const priorityTextClass = priorityLevel === 'critical'
    ? 'text-red-500'
    : priorityLevel === 'high'
      ? 'text-orange-500'
      : 'text-green-500';
  const gpsLabel = farmer?.locationLat !== undefined && farmer?.locationLat !== null
    ? `Lat: ${Number(farmer.locationLat).toFixed(4)} • Lng: ${Number(farmer.locationLng ?? 0).toFixed(4)}`
    : 'GPS coordinates unavailable';

  return (
    <div className={`aspect-video rounded-xl relative overflow-hidden border ${isCyber ? 'bg-black/40 border-primary-500/20' : 'bg-gray-100 border-gray-200'}`}>
      <div className="absolute inset-0 bg-slate-50 dark:bg-theme-bg-secondary" />
      {isCyber && <div className="absolute inset-0 cyber-grid-premium opacity-30" />}

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {dataPoints.map((point, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.8, scale: 1 }}
              className="absolute w-4 h-4"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              <div className={`w-full h-full rounded-full ${String(point.colorClass ?? '')} blur-md opacity-40 pulse-ring`} />
              <div className={`absolute inset-0 w-2 h-2 m-auto rounded-full ${String(point.pulseClass ?? '')} border border-white/40 shadow-lg`} />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-600 dark:text-theme-text-muted whitespace-nowrap">
                NDVI {String(point.ndvi ?? 0)}
              </div>
            </motion.div>
          ))}
          {dataPoints.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xxs font-medium text-white/20  ">{t('ui_satellite_insights_no_satellite_observation')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 start-4 bg-slate-900/[0.04] dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08]">
        <p className="text-xs font-medium text-primary-400 flex items-center gap-2">
          <Layers className="w-3 h-3" />
          {t('ui_satellite_insights_spectral_layer_iv')}
        </p>
      </div>

      {priority && (
        <div className="absolute top-4 end-4 bg-slate-900/[0.04] dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08]">
          <div className={`text-xs font-medium flex items-center gap-2 ${priorityTextClass}`}>
            {isHighOrCritical ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {String(priority.level ?? 'unknown')} PRIORITY
          </div>
        </div>
      )}

      <div className="absolute bottom-4 start-4">
        <p className="text-xxs font-medium text-slate-600 dark:text-theme-text-muted  ">{gpsLabel}</p>
      </div>
      <div className="absolute bottom-4 end-4 text-end">
        <p className="text-xxs font-medium text-slate-600 dark:text-theme-text-muted  ">
          {dataPoints.length > 0 ? `Source: ${String(dataPoints[0].source ?? 'provider')}` : 'No satellite observation'}
        </p>
      </div>
    </div>
  );
};

const MetricsGrid = ({
  priority,
  isCyber,
  isLoading,
}: {
  priority: PriorityLike | null;
  isCyber: boolean;
  isLoading: boolean;
}) => {
  const { t } = useLanguage();
  const isCritical = priority?.level === 'critical';
  const containerClass = isCritical
    ? 'bg-red-500/5 border-red-500/20'
    : isCyber
      ? 'bg-slate-900/[0.04] dark:bg-black/40 border-slate-900/[0.08] dark:border-white/[0.08]'
      : 'bg-white border-gray-100 shadow-sm';
  const reasons = priority?.reasons ?? [];
  const score = priority?.score ?? 0;

  return (
    <div className={`p-6 rounded-xl border transition-all ${containerClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h5 className="text-xxs font-medium text-gray-400">{t('ui_satellite_insights_resource_priority_index')}</h5>
        {priority && <div className={`px-2 py-0.5 rounded text-xxs font-medium ${isCritical ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'}`}>{score}%</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {reasons.slice(0, 4).map((reason, index) => (
          <div key={index} className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary-500" />
            <span className="text-xxs font-medium text-gray-400 line-clamp-1">{reason}</span>
          </div>
        ))}
      </div>

      <div className={`p-3 rounded-xl flex items-center gap-3 ${isCyber ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className={`p-1.5 rounded-lg ${isCritical ? 'bg-red-500/20 text-red-500' : 'bg-primary-500/20 text-primary-500'}`}>
          {isCritical ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-micro font-medium text-gray-500  ">{t('ui_satellite_insights_recommended_action')}</p>
          <p className={`text-xs-plus font-medium ${isCyber ? 'text-white' : 'text-gray-900'}`}>
            {isLoading ? 'Calculating...' : priority?.recommendedAction || 'No verified recommendation available.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export const SatelliteInsights: React.FC<SatelliteInsightsProps> = ({ farmerId, isCyber, metrics }) => {
  const { t } = useLanguage();
  const { synthesis, farmer, priority, satelliteData, isLoading, dataError } = useSatelliteData(farmerId);
  const dataPoints = satelliteData.map((data, index) => {
    const x = 50 + (index % 2 === 0 ? 5 : -5);
    const y = 50 + (index < 2 ? 5 : -5);
    const healthy = data.health === 'healthy';
    const normal = data.health === 'normal';
    return {
      x,
      y,
      colorClass: healthy ? 'bg-green-500' : normal ? 'bg-amber-500' : 'bg-red-500',
      pulseClass: healthy ? 'bg-green-400' : normal ? 'bg-amber-400' : 'bg-red-400',
      ndvi: data.ndvi,
      source: data.source,
    };
  });
  void metrics;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isCyber ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-primary-100 text-primary-600'}`}><Cpu className="w-5 h-5" /></div>
          <div>
            <h4 className={`text-xs font-medium   ${isCyber ? 'text-primary-400' : 'text-gray-900'}`}>{t('ui_satellite_insights_spatial_intelligence')}</h4>
            <p className="text-xxs text-gray-500 font-medium">{satelliteData.length > 0 ? 'Provider Telemetry' : 'Telemetry Unavailable'} • ID: {farmerId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${satelliteData.length > 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={`text-xxs font-medium tracking-tighter ${satelliteData.length > 0 ? 'text-green-500' : 'text-amber-500'}`}>{satelliteData.length > 0 ? 'Live observation' : 'Unavailable'}</span>
        </div>
      </div>

      {dataError && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">{dataError}</div>}

      <SpatialDataVisualization dataPoints={dataPoints} isLoading={isLoading} isCyber={isCyber ?? false} priority={priority as PriorityLike} farmer={farmer as FarmerLike} />
      <MetricsGrid priority={priority as PriorityLike} isCyber={isCyber ?? false} isLoading={isLoading} />

      <div className={`p-6 rounded-xl border relative min-h-[140px] flex flex-col justify-center ${isCyber ? 'bg-primary-500/5 border-primary-500/20' : 'bg-slate-50/50 border-slate-100'}`}>
        <h5 className={`text-xxs font-medium mb-3 flex items-center gap-2 ${isCyber ? 'text-primary-400' : 'text-slate-600'}`}>
          <Navigation2 className="w-3 h-3" />
          {isLoading ? 'Generating Synthesis...' : 'Growth trajectory analysis'}
        </h5>
        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div> : <p className={`text-xs leading-relaxed font-medium ${isCyber ? 'text-gray-300' : 'text-gray-600'}`}>{synthesis || dataError || 'No verified synthesis is available.'}</p>}
      </div>
    </div>
  );
};
