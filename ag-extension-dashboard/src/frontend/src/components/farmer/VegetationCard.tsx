import React from 'react';
import { Loader2, Sprout, CloudOff, MapPin } from 'lucide-react';
import type { NDVIPoint } from '@/api/agriDataService';
import type { MarketDataStatus } from '@/api/priceService';
import { DATA_STATUS_LABELS } from './dataStatusLabels';


/** Rising prices read green, falling red; anything else (e.g. "Stable") stays neutral. */
function vegInterpret(ndvi: number): { label: string; color: string } {
  if (ndvi >= 0.7) return { label: 'Lush', color: 'text-emerald-600 dark:text-emerald-400' };
  if (ndvi >= 0.5) return { label: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400' };
  if (ndvi >= 0.35) return { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400' };
  if (ndvi >= 0.2) return { label: 'Stressed', color: 'text-rose-600 dark:text-rose-400' };
  return { label: 'Bare', color: 'text-slate-500' };
}

function barColor(p: NDVIPoint): string {
  return p.ndvi >= 0.5 ? '#10b981' : p.ndvi >= 0.35 ? '#f59e0b' : '#ef4444';
}

/** A quiet message in place of a card's figures. */
function CardNotice({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 max-w-[16rem]">{text}</p>
    </div>
  );
}

/** The latest vegetation index and the last two weeks as bars. */
function VegetationFigures({ data }: { data: { data: NDVIPoint[]; dataStatus: string; reason: string } }) {
  const points = data.data;
  const ndvi = points[points.length - 1].ndvi;
  const veg = vegInterpret(ndvi);
  const maxBar = Math.max(0.05, ...points.map(p => p.ndvi), 1);
  return (
    <>
      <div className="flex items-baseline gap-2 mb-5">
        <span className={`text-3xl font-medium ${veg.color}`}>
          {ndvi.toFixed(2)}
        </span>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{veg.label}</span>
      </div>

      <div className="flex items-end gap-0.5 h-14 mb-2">
        {points.slice(-14).map((p, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${Math.max((p.ndvi / maxBar) * 100, 3)}%`, backgroundColor: barColor(p) }}
          />
        ))}
      </div>

      <div className="flex justify-between text-xxs text-gray-400 dark:text-gray-500 font-mono mt-1">
        <span>{points[0]?.date.slice(5) || ''}</span>
        <span>{points[points.length - 1]?.date.slice(5) || ''}</span>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.12] flex items-center justify-between">
        <span className="text-xxs text-gray-400 dark:text-gray-500 capitalize">{data.reason || ''}</span>
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          {data.dataStatus === 'live' ? 'NASA POWER' : data.dataStatus ? DATA_STATUS_LABELS[data.dataStatus as MarketDataStatus] : null}
        </span>
      </div>
    </>
  );
}

/** Vegetation on the farmer's own fields, or what is needed before it can be shown. */
export function VegetationCard({ data, loading, isError, hasLocation }: {
  data: { data: NDVIPoint[]; dataStatus: string; reason: string } | undefined;
  loading: boolean;
  isError: boolean;
  hasLocation: boolean;
}) {
  const points = data?.data || [];
  const latest = points[points.length - 1];
  const veg = latest?.ndvi != null ? vegInterpret(latest.ndvi) : null;

  return (
    <div className="bg-white dark:bg-white/[0.03] p-5 sm:p-6 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            Vegetation health
          </h3>
          <p className="text-xxs text-gray-400 dark:text-gray-500">14-day agroclimatology proxy</p>
        </div>
      </div>

      {!hasLocation ? (
        <CardNotice icon={MapPin} text="Add your farm's location in your profile, or ask your officer to, to see the vegetation on your own fields." />
      ) : loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : isError || !veg ? (
        <CardNotice icon={CloudOff} text="Vegetation data unavailable" />
      ) : (
        <VegetationFigures data={data!} />
      )}
    </div>
  );
}
