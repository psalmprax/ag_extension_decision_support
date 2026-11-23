import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CloudOff, Loader2, MapPin, Sprout } from 'lucide-react';
import { fetchNDVITimeSeries, NDVIPoint } from '@/api/agriDataService';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { MiniBars } from '@/components/charts/MiniBars';

type Translate = (key: string, options?: { defaultValue?: string }) => string;

/** A plain-language band for the index, with a colour that reads in both modes. */
function vegInterpret(ndvi: number, t: Translate): { label: string; color: string } {
  if (ndvi >= 0.7) return { label: t('veg_health_lush', { defaultValue: 'Lush' }), color: 'text-emerald-700 dark:text-emerald-400' };
  if (ndvi >= 0.5) return { label: t('veg_health_healthy', { defaultValue: 'Healthy' }), color: 'text-emerald-700 dark:text-emerald-400' };
  if (ndvi >= 0.35) return { label: t('veg_health_moderate', { defaultValue: 'Moderate' }), color: 'text-amber-700 dark:text-amber-400' };
  if (ndvi >= 0.2) return { label: t('veg_health_stressed', { defaultValue: 'Stressed' }), color: 'text-rose-700 dark:text-rose-400' };
  return { label: t('veg_health_bare', { defaultValue: 'Bare' }), color: 'text-slate-700 dark:text-theme-text-secondary' };
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The signed-in user's own position, or null. No default place: another area's figures would be wrong here. */
function getCoordinates(user: unknown): { lat: number; lng: number } | null {
  const coordinates = user as { latitude?: unknown; longitude?: unknown } | null;
  return isCoordinate(coordinates?.latitude) && isCoordinate(coordinates?.longitude)
    ? { lat: coordinates.latitude, lng: coordinates.longitude }
    : null;
}

const Notice: React.FC<{ icon: typeof CloudOff; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex flex-col items-center justify-center py-6 text-center">
    <Icon className="mb-2 h-[18px] w-[18px] text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
    <p className="max-w-[16rem] text-xs text-slate-600 dark:text-theme-text-muted">{text}</p>
  </div>
);

/** An estimated vegetation index for the user's own area over the last two weeks. */
export const VegetationHealthCard: React.FC<{ cardClass: string }> = ({ cardClass }) => {
  const user = useAppStore(s => s.user);
  const { t } = useLanguage();
  const coordinates = getCoordinates(user);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vegetation-health', coordinates?.lat, coordinates?.lng],
    queryFn: () => fetchNDVITimeSeries(coordinates!.lat, coordinates!.lng, 14),
    enabled: Boolean(user && coordinates),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const points: NDVIPoint[] = data?.data || [];
  const latest = points[points.length - 1];
  const veg = latest ? vegInterpret(latest.ndvi, t) : null;

  return (
    <div className={`${cardClass} p-4 sm:p-6`}>
      <div className="mb-4 flex items-start gap-2">
        <Sprout className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">
            {t('veg_health_title', { defaultValue: 'Regional vegetation health (estimated)' })}
          </h3>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted">
            {t('veg_health_subtitle', { defaultValue: 'Climate-based vigor proxy — not satellite NDVI' })}
          </p>
        </div>
      </div>
      {!coordinates ? (
        <Notice icon={MapPin} text={t('veg_health_needs_location', { defaultValue: 'Add your location to your profile to see vegetation for your area.' })} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-theme-text-muted" aria-hidden="true" />
        </div>
      ) : isError || !veg || !latest ? (
        <Notice icon={CloudOff} text={t('veg_health_unavailable', { defaultValue: 'Data unavailable' })} />
      ) : (
        <>
          <div className="mb-4 flex items-baseline gap-2">
            <span className={`text-2xl font-medium ${veg.color}`}>{latest.ndvi.toFixed(2)}</span>
            <span className="text-xs font-medium text-slate-700 dark:text-theme-text-secondary">{veg.label}</span>
          </div>
          <MiniBars
            heightClass="h-16"
            points={points.slice(-14).map(point => ({ date: point.date, value: point.ndvi }))}
            max={1}
            format={value => value.toFixed(2)}
            label={t('veg_health_by_day', { defaultValue: 'Estimated vegetation index by day' })}
          />
          <div className="mt-3 flex items-center justify-between border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.08]">
            <span className="text-xs text-slate-600 dark:text-theme-text-muted">{data?.reason || ''}</span>
            {data?.dataStatus === 'estimated' && (
              <span className="rounded border border-amber-700/15 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-400/[0.12] dark:text-amber-200">
                {t('veg_health_estimated_proxy', { defaultValue: 'Estimated NDVI proxy' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
