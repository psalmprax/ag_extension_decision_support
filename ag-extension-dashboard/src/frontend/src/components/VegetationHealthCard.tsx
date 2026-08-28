import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sprout, Loader2, CloudOff } from 'lucide-react';
import { fetchNDVITimeSeries, NDVIPoint } from '@/api/agriDataService';
import { useAppStore } from '@/store/useAppStore';

function vegInterpret(ndvi: number): { label: string; color: string; barColor: string } {
  if (ndvi >= 0.7) return { label: 'Lush', color: 'text-emerald-400', barColor: 'bg-emerald-500' };
  if (ndvi >= 0.5) return { label: 'Healthy', color: 'text-emerald-400', barColor: 'bg-emerald-500' };
  if (ndvi >= 0.35) return { label: 'Moderate', color: 'text-amber-400', barColor: 'bg-amber-500' };
  if (ndvi >= 0.2) return { label: 'Stressed', color: 'text-rose-400', barColor: 'bg-rose-500' };
  return { label: 'Bare', color: 'text-slate-400', barColor: 'bg-slate-500' };
}

interface VegetationHealthCardProps {
  cardClass: string;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireCoordinate(value: unknown, label: string): number {
  if (isCoordinate(value)) return value;
  throw new Error(`${label} coordinates are unavailable`);
}

function getCoordinates(user: unknown): { lat: number; lng: number } {
  const coordinates = user as { latitude?: unknown; longitude?: unknown } | null;
  return {
    lat: requireCoordinate(coordinates?.latitude, 'Farmer'),
    lng: requireCoordinate(coordinates?.longitude, 'Farmer'),
  };
}

export const VegetationHealthCard: React.FC<VegetationHealthCardProps> = ({ cardClass }) => {
  const user = useAppStore(s => s.user);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vegetation-health'],
    queryFn: async () => {
      const { lat, lng } = getCoordinates(user);
      return fetchNDVITimeSeries(lat, lng, 14);
    },
    enabled: !!user,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const points: NDVIPoint[] = data?.data || [];
  const latest = points[points.length - 1];
  const latestNdvi = latest?.ndvi;
  const veg = latestNdvi !== undefined ? vegInterpret(latestNdvi) : null;
  const maxBar = Math.max(0.05, ...points.map(p => p.ndvi), 1);

  return (
    <div className={`${cardClass} p-4 sm:p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <Sprout className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Vegetation Health
          </h3>
          <p className="text-xxs text-slate-400">14-day agroclimatology proxy</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        </div>
      ) : isError || !veg ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CloudOff className="w-6 h-6 text-slate-400 mb-2" />
          <p className="text-xxs text-slate-400 font-bold uppercase">Vegetation data unavailable</p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className={`text-2xl font-black ${veg.color}`}>
              {latestNdvi!.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">{veg.label}</span>
          </div>

          <div className="flex items-end gap-0.5 h-16 mb-2">
            {points.slice(-14).map((p, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${Math.max((p.ndvi / maxBar) * 100, 4)}%`,
                  backgroundColor: p.ndvi >= 0.5 ? 'rgb(16 185 129)' : p.ndvi >= 0.35 ? 'rgb(245 158 11)' : 'rgb(244 63 94)',
                }}
              />
            ))}
          </div>

          <div className="flex justify-between text-xxs text-slate-500 font-mono">
            <span>{points[0]?.date.slice(5) || ''}</span>
            <span>{points[points.length - 1]?.date.slice(5) || ''}</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xxs text-slate-400 capitalize">{data?.reason || ''}</span>
            <motion.span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {data?.dataStatus === 'estimated' ? 'ESTIMATED PROXY' : data?.dataStatus?.toUpperCase()}
            </motion.span>
          </div>
        </>
      )}
    </div>
  );
};