import React from 'react';
import { Loader2, Sprout, CloudOff, MapPin } from 'lucide-react';
import type { NDVIPoint } from '@/api/agriDataService';
import type { MarketDataStatus } from '@/api/priceService';
import { dataStatusLabel } from './dataStatusLabels';
import { useLanguage } from '@/lib/LanguageContext';
import { MiniBars } from '@/components/charts/MiniBars';


/** A plain-language band for a vegetation index value: its label key, English label and colour. */
function vegInterpret(ndvi: number): { key: string; label: string; color: string } {
  if (ndvi >= 0.7) return { key: 'veg_band_lush', label: 'Lush', color: 'text-emerald-600 dark:text-emerald-400' };
  if (ndvi >= 0.5) return { key: 'veg_band_healthy', label: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400' };
  if (ndvi >= 0.35) return { key: 'veg_band_moderate', label: 'Moderate', color: 'text-amber-600 dark:text-amber-400' };
  if (ndvi >= 0.2) return { key: 'veg_band_stressed', label: 'Stressed', color: 'text-rose-600 dark:text-rose-400' };
  return { key: 'veg_band_bare', label: 'Bare', color: 'text-slate-500' };
}

/** A quiet message in place of a card's figures. */
function CardNotice({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-xs font-medium text-gray-500 dark:text-theme-text-muted max-w-[16rem]">{text}</p>
    </div>
  );
}

/** The latest vegetation index and the last two weeks as bars. */
function VegetationFigures({ data }: { data: { data: NDVIPoint[]; dataStatus: string; reason: string } }) {
  const { t } = useLanguage();
  const points = data.data;
  const ndvi = points[points.length - 1].ndvi;
  const veg = vegInterpret(ndvi);
  return (
    <>
      <div className="flex items-baseline gap-2 mb-5">
        <span className={`text-3xl font-medium ${veg.color}`}>
          {ndvi.toFixed(2)}
        </span>
        <span className="text-sm font-medium text-gray-500 dark:text-theme-text-muted">{t(veg.key, { defaultValue: veg.label })}</span>
      </div>

      <MiniBars
        points={points.slice(-14).map(p => ({ date: p.date, value: p.ndvi }))}
        max={1}
        format={value => value.toFixed(2)}
        label={t('veg_index_by_day', { defaultValue: 'Vegetation index by day' })}
      />

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.12] flex items-center justify-between">
        <span className="text-xxs text-gray-400 dark:text-theme-text-muted capitalize">{data.reason || ''}</span>
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          {data.dataStatus === 'live' ? 'NASA POWER' : data.dataStatus ? dataStatusLabel(t, data.dataStatus as MarketDataStatus) : null}
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
  const { t } = useLanguage();
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
            {t('veg_card_title', { defaultValue: 'Vegetation health' })}
          </h3>
          <p className="text-xxs text-gray-400 dark:text-theme-text-muted">{t('veg_card_subtitle', { defaultValue: '14-day agroclimatology proxy' })}</p>
        </div>
      </div>

      {!hasLocation ? (
        <CardNotice icon={MapPin} text={t('veg_needs_location', { defaultValue: "Add your farm's location in your profile, or ask your officer to, to see the vegetation on your own fields." })} />
      ) : loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : isError || !veg ? (
        <CardNotice icon={CloudOff} text={t('veg_unavailable', { defaultValue: 'Vegetation data unavailable' })} />
      ) : (
        <VegetationFigures data={data!} />
      )}
    </div>
  );
}
