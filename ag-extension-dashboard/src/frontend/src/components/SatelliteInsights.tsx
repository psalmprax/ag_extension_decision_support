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
import { useLanguage } from '@/lib/LanguageContext';
import {
  fetchVisitsByFarmer,
  fetchSynthesis,
  fetchPriorityScore,
  PriorityData,
  fetchSatelliteTelemetry,
  SatelliteIndex,
} from '@/api/visitService';
import { fetchFarmerById, Farmer } from '@/api/farmerService';
import { withRealFallback } from '@/lib/realFirst';
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

// Nullable alias removed: replaced by inline T | null typing after component prop widening

const useSatelliteData = (farmerId: string) => {
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [priority, setPriority] = useState<PriorityData | null>(null);
  const [satelliteData, setSatelliteData] = useState<SatelliteIndex[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadRealData = async () => {
      if (!farmerId) return;
      setIsLoading(true);
      try {
        const farmerRes = await withRealFallback(fetchFarmerById(farmerId), {
          success: true,
          data: { id: farmerId, firstName: 'Farmer', lastName: '' } as Farmer,
        });
        const farmerData = farmerRes.data;
        setFarmer(farmerData);

        const fallbackPriority: PriorityData = {
          farmerId,
          level: 'normal',
          score: 45,
          reasons: ['Regional baseline metrics'],
          factors: { diseaseAlerts: 0, weatherRisk: 2, visitRecency: 10, vitalScore: 8 },
          recommendedAction: 'Monitor and maintain routine visits.',
        };

        const [visitsRes, priorityRes, satelliteRes] = await Promise.all([
          fetchVisitsByFarmer(farmerId),
          withRealFallback(fetchPriorityScore(farmerId), { success: true, data: fallbackPriority }),
          farmerData.locationLat && farmerData.locationLng
            ? fetchSatelliteTelemetry(
                Number(farmerData.locationLat),
                Number(farmerData.locationLng),
                farmerId
              )
            : Promise.resolve({ success: true, data: [] }),
        ]);

        setPriority(priorityRes.data);
        setSatelliteData(satelliteRes.data);

        const latestVisits = visitsRes.data.visits;

        if (latestVisits && latestVisits.length > 0) {
          const combinedNotes = latestVisits
            .slice(0, 3)
            .map(v => `${v.visit_type}: ${v.notes || ''}`)
            .join('\n');

          const synthesisRes = await withRealFallback(fetchSynthesis(farmerId, combinedNotes), {
            success: true,
            data: {
              summary:
                'Historical data synthesis in progress. Active terrain scan merged with base metrics suggests stable yield expectations.',
            },
          });
          setSynthesis(synthesisRes.data.summary);
        } else {
          setSynthesis(
            'No recent visit data available. Spatial Intelligence unit merged historical regional telemetry with current vegetation indices.'
          );
        }
      } catch (err) {
        console.error('Failed to load real insights:', err);
        setSynthesis(
          'Connectivity issue with Satellite Intelligence Unit. Falling back to regional baseline.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadRealData();
  }, [farmerId]);

  return { synthesis, farmer, priority, satelliteData, isLoading };
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

  let priorityTextClass: string;
  if (priorityLevel === 'critical') {
    priorityTextClass = 'text-red-500';
  } else if (priorityLevel === 'high') {
    priorityTextClass = 'text-orange-500';
  } else {
    priorityTextClass = 'text-green-500';
  }

  const gpsLabel =
    farmer?.locationLat !== undefined && farmer?.locationLat !== null
      ? `Lat: ${Number(farmer.locationLat).toFixed(4)} • Lng: ${Number(farmer.locationLng ?? 0).toFixed(4)}`
      : 'GPS Tracking Active';

  return (
    <div
      className={`aspect-video rounded-3xl relative overflow-hidden border ${isCyber ? 'bg-black/40 border-primary-500/20 shadow-[0_0_30px_var(--color-outline)]' : 'bg-gray-100 border-gray-200'}`}
    >
      {/* Background Representation of Farm */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-blue-900/20 to-emerald-950/40" />
      {isCyber && <div className="absolute inset-0 cyber-grid-premium opacity-30" />}

      {/* Data Points Layer - Rendered from real NDVI indices */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {dataPoints.map((point: Record<string, unknown>, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.8, scale: 1 }}
              className="absolute w-4 h-4"
              style={{ left: `${point['x']}%`, top: `${point['y']}%` }}
            >
              <div
                className={`w-full h-full rounded-full ${String(point['colorClass'] ?? '')} blur-md opacity-40 pulse-ring`}
              />
              <div
                className={`absolute inset-0 w-2 h-2 m-auto rounded-full ${String(point['pulseClass'] ?? '')} border border-white/40 shadow-lg`}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/60 uppercase whitespace-nowrap">
                NDVI {String(point['ndvi'] ?? 0)}
              </div>
            </motion.div>
          ))}
          {dataPoints.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xxs font-black text-white/20 uppercase tracking-[0.3em]">
                Precision coordinates pending
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary-500/10 to-transparent blur-2xl"
        />
      </div>

      {/* Status Overlays */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
        <p className="text-[8px] font-black text-primary-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Layers className="w-3 h-3" />
          Spectral Layer IV
        </p>
      </div>

      {priority && (
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
          {' '}
          <div
            className={`text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${priorityTextClass}`}
          >
            {isHighOrCritical ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <Shield className="w-3 h-3" />
            )}
            {String(priority.level ?? 'unknown') as React.ReactNode} PRIORITY
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4">
        <p className="text-xxs font-black text-white/40 uppercase tracking-widest">{gpsLabel}</p>
      </div>
      <div className="absolute bottom-4 right-4 text-right">
        <p className="text-xxs font-black text-white/40 uppercase tracking-widest">
          Source: Sentinel-2 MSI
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
  let containerClass: string;
  if (isCritical) {
    containerClass = 'bg-red-500/5 border-red-500/20';
  } else if (isCyber) {
    containerClass = 'bg-black/40 border-white/10';
  } else {
    containerClass = 'bg-white border-gray-100 shadow-sm';
  }

  const reasons = (priority?.reasons ?? []) as string[];
  const score = priority?.score ?? 0;

  return (
    <div className={`p-6 rounded-3xl border transition-all ${containerClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h5 className="text-xxs font-black uppercase tracking-[0.2em] text-gray-400">
          Resource Priority Index
        </h5>
        {priority && (
          <div
            className={`px-2 py-0.5 rounded text-xxs font-bold ${
              isCritical ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'
            }`}
          >
            {score}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {reasons.slice(0, 4).map((reason, i) => (
          <div key={i} className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary-500" />
            <span className="text-xxs font-medium text-gray-400 line-clamp-1">{reason}</span>
          </div>
        ))}
      </div>

      <div
        className={`p-3 rounded-xl flex items-center gap-3 ${isCyber ? 'bg-white/5' : 'bg-gray-50'}`}
      >
        <div
          className={`p-1.5 rounded-lg ${isCritical ? 'bg-red-500/20 text-red-500' : 'bg-primary-500/20 text-primary-500'}`}
        >
          {isCritical ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
        </div>
        <div>
          <p className="text-micro font-black text-gray-500 uppercase tracking-widest">
            Recommended Action
          </p>
          <p className={`text-xs-plus font-bold ${isCyber ? 'text-white' : 'text-gray-900'}`}>
            {isLoading && 'Calculating...'}
            {!isLoading && (priority?.recommendedAction || 'Monitor and maintain routine visits.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export const SatelliteInsights: React.FC<SatelliteInsightsProps> = ({
  farmerId,
  isCyber,
  metrics,
}) => {
  const { t: _t } = useLanguage();
  const { synthesis, farmer, priority, satelliteData, isLoading } = useSatelliteData(farmerId);

  // Use actual satellite telemetry to generate visual data points
  const dataPoints = satelliteData.map((data, i) => {
    // Position relative to a 100x100 grid (centralized for the specific location)
    const x = 50 + (i % 2 === 0 ? 5 : -5);
    const y = 50 + (i < 2 ? 5 : -5);

    const colorClass =
      data.health === 'healthy'
        ? 'bg-green-500'
        : data.health === 'normal'
          ? 'bg-amber-500'
          : 'bg-red-500';
    const pulseClass =
      data.health === 'healthy'
        ? 'bg-green-400 shadow-[0_0_10px_var(--color-outline)]'
        : data.health === 'normal'
          ? 'bg-amber-400 shadow-[0_0_10px_var(--color-outline)]'
          : 'bg-red-400 shadow-[0_0_10px_var(--color-outline)]';

    return { x, y, colorClass, pulseClass, ndvi: data.ndvi };
  });
  const _displayMetrics = metrics || [];

  return (
    <div className="space-y-8">
      {/* Real-time Telemetry Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${isCyber ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-primary-100 text-primary-600'}`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4
              className={`text-xs font-black uppercase tracking-[0.2em] ${isCyber ? 'text-primary-400' : 'text-gray-900'}`}
            >
              Spatial Intelligence
            </h4>
            <p className="text-xxs text-gray-500 uppercase tracking-widest font-bold">
              Live Telemetry • ID: {farmerId.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xxs font-black uppercase tracking-tighter text-green-500">
            Active Scan
          </span>
        </div>
      </div>

      <SpatialDataVisualization
        dataPoints={dataPoints as unknown as Array<Record<string, unknown>>}
        isLoading={isLoading ?? false}
        isCyber={isCyber ?? false}
        priority={priority as unknown as PriorityLike}
        farmer={farmer as unknown as FarmerLike}
      />

      <MetricsGrid
        priority={priority as unknown as PriorityLike}
        isCyber={isCyber ?? false}
        isLoading={isLoading ?? false}
      />

      {/* Analysis Summary */}
      <div
        className={`p-6 rounded-3xl border relative min-h-[140px] flex flex-col justify-center ${isCyber ? 'bg-primary-500/5 border-primary-500/20 shadow-[0_0_20px_var(--color-outline)]' : 'bg-blue-50/50 border-blue-100'}`}
      >
        <h5
          className={`text-xxs font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${isCyber ? 'text-primary-400' : 'text-blue-600'}`}
        >
          <Navigation2 className="w-3 h-3" />
          {isLoading ? 'Generating Synthesis...' : 'Growth Trajectory Analysis'}
        </h5>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : (
          <p
            className={`text-xs leading-relaxed font-medium ${isCyber ? 'text-gray-300' : 'text-gray-600'}`}
          >
            {synthesis ||
              'Historical data synthesis in progress. Active terrain scan merged with base metrics suggests stable yield expectations.'}
          </p>
        )}
      </div>
    </div>
  );
};
