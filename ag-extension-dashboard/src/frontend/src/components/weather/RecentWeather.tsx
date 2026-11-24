import React from 'react';
import { CloudOff, CloudRain, Loader2, MapPin } from 'lucide-react';
import type { RecentWeatherResult } from '@/api/agriDataService';
import { MiniBars } from '@/components/charts/MiniBars';
import { useLanguage } from '@/lib/LanguageContext';
import { appLocale } from '@/lib/appLocale';

const Notice: React.FC<{ icon: typeof CloudOff; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex flex-col items-center justify-center py-6 text-center">
    <Icon className="mb-2 h-[18px] w-[18px] text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
    <p className="max-w-[16rem] text-xs text-slate-600 dark:text-theme-text-muted">{text}</p>
  </div>
);

const one = (value: number) => value.toLocaleString(appLocale(), { maximumFractionDigits: 1 });

/**
 * Rain by day and the temperature range NASA POWER measured over the last two weeks. It is the
 * weather at the point, not a measure of the crop, and says so in its title.
 */
export function RecentWeather({ data, loading, isError, hasLocation, scope }: {
  data: RecentWeatherResult | undefined;
  loading: boolean;
  isError: boolean;
  hasLocation: boolean;
  /** Whose place it is: the farmer's farm, or the officer's area. */
  scope: 'farm' | 'area';
}) {
  const { t } = useLanguage();
  const days = data?.data ?? [];
  const rain = days.reduce((sum, day) => sum + day.rainMm, 0);
  const temps = days.map(day => day.tempC);

  return (
    <div>
      <div className="mb-4 flex items-start gap-2">
        <CloudRain className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">{t('weather_recent_title', { defaultValue: 'Rain and temperature' })}</h3>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted">
            {scope === 'farm'
              ? t('weather_recent_subtitle_farm', { defaultValue: 'Last two weeks at your farm, measured by NASA POWER' })
              : t('weather_recent_subtitle_area', { defaultValue: 'Last two weeks in your area, measured by NASA POWER' })}
          </p>
        </div>
      </div>
      {!hasLocation ? (
        <Notice icon={MapPin} text={t('weather_recent_needs_location', { defaultValue: 'Add the location to the profile to see the weather there.' })} />
      ) : loading ? (
        <div className="flex items-center justify-center py-8" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-theme-text-muted" aria-hidden="true" />
        </div>
      ) : isError || days.length === 0 ? (
        <Notice icon={CloudOff} text={t('weather_recent_unavailable', { defaultValue: 'No weather measurements for these days yet.' })} />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-900 dark:text-theme-text-primary tabular-nums">
            {t('weather_recent_summary', {
              defaultValue: '{rain} mm of rain; daily mean temperature {min} to {max} °C',
              rain: one(rain), min: one(Math.min(...temps)), max: one(Math.max(...temps)),
            })}
          </p>
          <MiniBars
            heightClass="h-16"
            points={days.slice(-14).map(day => ({ date: day.date, value: day.rainMm }))}
            max={Math.max(1, ...days.map(day => day.rainMm))}
            format={value => `${one(value)} mm`}
            label={t('weather_recent_rain_by_day', { defaultValue: 'Rain by day, mm' })}
          />
        </>
      )}
    </div>
  );
}
