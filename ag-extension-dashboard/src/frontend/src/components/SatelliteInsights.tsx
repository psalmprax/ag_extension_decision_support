import React, { useEffect, useState } from 'react';
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
import {
  fetchVisitsByFarmer,
  fetchSynthesis,
  fetchPriorityScore,
  PriorityData,
  fetchSatelliteTelemetry,
  SatelliteIndex,
} from '@/api/visitService';
import { fetchFarmerById, Farmer } from '@/api/farmerService';
import type { PriorityLike, FarmerLike } from '@/types/visit';

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

interface LoadedSatelliteData {
  synthesis: string;
  farmer: Farmer;
  priority: PriorityData | null;
  satelliteData: SatelliteIndex[];
}

async function loadSynthesis(farmerId: string, visits: Array<{ visit_type: string; notes?: string }>): Promise<string> {
  if (visits.length === 0) return 'No recent visit data available.';
  const notes = visits
    .slice(0, 3)
    .map(visit => `${visit.visit_type}: ${visit.notes || ''}`)
    .join('\n');
  const response = await fetchSynthesis(farmerId, notes);
  return response.success ? response.data.summary : 'Visit synthesis is unavailable.';
}

async function loadSatelliteData(farmerId: string): Promise<LoadedSatelliteData> {
  const farmerResponse = await fetchFarmerById(farmerId);
  if (!farmerResponse.success) throw new Error('Farmer profile unavailable');

  const farmer = farmerResponse.data;
  const [visitsResponse, priorityResponse, satelliteResponse] = await Promise.all([
    fetchVisitsByFarmer(farmerId),
    fetchPriorityScore(farmerId),
    farmer.locationLat && farmer.locationLng
      ? fetchSatelliteTelemetry(Number(farmer.locationLat), Number(farmer.locationLng), farmerId)
      : Promise.resolve({ success: true, data: [] as SatelliteIndex[] }),
  ]);

  return {
    farmer,
    priority: priorityResponse.success ? priorityResponse.data : null,
    satelliteData: satelliteResponse.success ? satelliteResponse.data : [],
    synthesis: await loadSynthesis(farmerId, visitsResponse.data.visits),
  };
}

const useSatelliteData = (farmerId: string) => {
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [priority, setPriority] = useState<PriorityData | null>(null);
  const [satelliteData, setSatelliteData] = useState<SatelliteIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmerId) return;
    let cancelled = false;
    setIsLoading(true);

    loadSatelliteData(farmerId)
      .then(data => {
        if (cancelled) return;
        setDataError(null);
        setFarmer(data.farmer);
        setPriority(data.priority);
        setSatelliteData(data.satelliteData);
        setSynthesis(data.synthesis);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Failed to load real insights:', error);
        setDataError('Live intelligence data is unavailable. Refresh to retry.');
        setFarmer(null);
        setPriority(null);
        setSatelliteData([]);
        setSynthesis(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farmerId]);

  return { synthesis, farmer, priority, satelliteData, isLoading, dataError };
};

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
    <div className={`aspect-video rounded-xl relative overflow-hidden border ${isCyber ? 'bg-black/40 border-primary-500/20 shadow-[0_0_30px_var(--color-outline)]' : 'bg-gray-100 border-gray-200'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-blue-900/20 to-emerald-950/40" />
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
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-white/60 uppercase whitespace-nowrap">
                NDVI {String(point.ndvi ?? 0)}
              </div>
            </motion.div>
          ))}
          {dataPoints.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xxs font-black text-white/20 uppercase tracking-[0.3em]">No satellite observation</p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary-500/10 to-transparent blur-2xl"
        />
      </div>

      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
        <p className="text-xs font-black text-primary-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Layers className="w-3 h-3" />
          Spectral Layer IV
        </p>
      </div>

      {priority && (
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
          <div className={`text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 ${priorityTextClass}`}>
            {isHighOrCritical ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {String(priority.level ?? 'unknown')} PRIORITY
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4">
        <p className="text-xxs font-black text-white/40 uppercase tracking-widest">{gpsLabel}</p>
      </div>
      <div className="absolute bottom-4 right-4 text-right">
        <p className="text-xxs font-black text-white/40 uppercase tracking-widest">
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
  const isCritical = priority?.level === 'critical';
  const containerClass = isCritical
    ? 'bg-red-500/5 border-red-500/20'
    : isCyber
      ? 'bg-black/40 border-white/10'
      : 'bg-white border-gray-100 shadow-sm';
  const reasons = priority?.reasons ?? [];
  const score = priority?.score ?? 0;

  return (
    <div className={`p-6 rounded-xl border transition-all ${containerClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h5 className="text-xxs font-black uppercase tracking-[0.2em] text-gray-400">Resource Priority Index</h5>
        {priority && <div className={`px-2 py-0.5 rounded text-xxs font-bold ${isCritical ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'}`}>{score}%</div>}
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
          <p className="text-micro font-black text-gray-500 uppercase tracking-widest">Recommended Action</p>
          <p className={`text-xs-plus font-bold ${isCyber ? 'text-white' : 'text-gray-900'}`}>
            {isLoading ? 'Calculating...' : priority?.recommendedAction || 'No verified recommendation available.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export const SatelliteInsights: React.FC<SatelliteInsightsProps> = ({ farmerId, isCyber, metrics }) => {
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
            <h4 className={`text-xs font-black uppercase tracking-[0.2em] ${isCyber ? 'text-primary-400' : 'text-gray-900'}`}>Spatial Intelligence</h4>
            <p className="text-xxs text-gray-500 uppercase tracking-widest font-bold">{satelliteData.length > 0 ? 'Provider Telemetry' : 'Telemetry Unavailable'} • ID: {farmerId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${satelliteData.length > 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={`text-xxs font-black uppercase tracking-tighter ${satelliteData.length > 0 ? 'text-green-500' : 'text-amber-500'}`}>{satelliteData.length > 0 ? 'Live observation' : 'Unavailable'}</span>
        </div>
      </div>

      {dataError && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">{dataError}</div>}

      <SpatialDataVisualization dataPoints={dataPoints} isLoading={isLoading} isCyber={isCyber ?? false} priority={priority as PriorityLike} farmer={farmer as FarmerLike} />
      <MetricsGrid priority={priority as PriorityLike} isCyber={isCyber ?? false} isLoading={isLoading} />

      <div className={`p-6 rounded-xl border relative min-h-[140px] flex flex-col justify-center ${isCyber ? 'bg-primary-500/5 border-primary-500/20 shadow-[0_0_20px_var(--color-outline)]' : 'bg-blue-50/50 border-blue-100'}`}>
        <h5 className={`text-xxs font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${isCyber ? 'text-primary-400' : 'text-blue-600'}`}>
          <Navigation2 className="w-3 h-3" />
          {isLoading ? 'Generating Synthesis...' : 'Growth Trajectory Analysis'}
        </h5>
        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div> : <p className={`text-xs leading-relaxed font-medium ${isCyber ? 'text-gray-300' : 'text-gray-600'}`}>{synthesis || dataError || 'No verified synthesis is available.'}</p>}
      </div>
    </div>
  );
};
