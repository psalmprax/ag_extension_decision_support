import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fieldRecordsService, type FieldSatelliteRecord } from '@/api/fieldRecordsService';
import { useLanguage } from '@/lib/LanguageContext';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatNumber } from '@/components/charts/chartFormat';

type Translate = ReturnType<typeof useLanguage>['t'];

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T00:00:00Z`));
}

function yesNo(t: Translate, value: boolean | null): string {
  if (value === null) return t('sat_no_answer', { defaultValue: 'No answer here' });
  return value ? t('common_yes', { defaultValue: 'Yes' }) : t('common_no', { defaultValue: 'No' });
}

/** Each fact as a label, a plain sentence and its source. */
function facts(t: Translate, record: FieldSatelliteRecord): Array<{ label: string; text: string; source: string }> {
  const out: Array<{ label: string; text: string; source: string }> = [];
  const { rainfall, greenness, floodHistory, cropland2019, worldCereal2021 } = record;
  if (rainfall) {
    out.push({
      label: t('sat_rain_label', { defaultValue: 'Rain last month' }),
      text: rainfall.percentOfAverage !== null && rainfall.averageMm !== null
        ? t('sat_rain_vs_average', { defaultValue: '{mm} mm in {month}: {pct}% of the average for that month over {years} earlier years ({avg} mm).', mm: rainfall.rainMm, month: monthLabel(rainfall.month), pct: rainfall.percentOfAverage, years: rainfall.baselineYears, avg: rainfall.averageMm })
        : t('sat_rain_only', { defaultValue: '{mm} mm in {month}.', mm: rainfall.rainMm, month: monthLabel(rainfall.month) }),
      source: rainfall.source,
    });
  }
  if (greenness) {
    const size = formatNumber(Math.abs(greenness.stdAnomaly), 1);
    out.push({
      label: t('sat_greenness_label', { defaultValue: 'Crop greenness' }),
      text: greenness.stdAnomaly < 0
        ? t('sat_greenness_below', { defaultValue: '{n} standard deviations below the 1984–2020 normal for {month}.', n: size, month: monthLabel(greenness.month) })
        : t('sat_greenness_above', { defaultValue: '{n} standard deviations above the 1984–2020 normal for {month}.', n: size, month: monthLabel(greenness.month) }),
      source: greenness.source,
    });
  }
  if (floodHistory) {
    const clear = floodHistory.clearObservations ?? 0;
    out.push({
      label: t('sat_flood_label', { defaultValue: 'Flood history' }),
      text: floodHistory.frequency > 0
        ? t('sat_flood_seen', { defaultValue: 'Seen under water in {pct}% of {clear} clear satellite views since 1984.', pct: formatNumber(floodHistory.frequency * 100, 1), clear })
        : t('sat_flood_never', { defaultValue: 'Not seen under water in {clear} clear satellite views since 1984.', clear }),
      source: floodHistory.source,
    });
  }
  if (cropland2019) {
    out.push({
      label: t('sat_cropland_label', { defaultValue: 'Mapped as cropland in 2019' }),
      text: cropland2019.probabilityPct === null
        ? yesNo(t, cropland2019.cropland)
        : t('sat_cropland_prob', { defaultValue: '{answer} ({pct}% probability).', answer: yesNo(t, cropland2019.cropland), pct: cropland2019.probabilityPct }),
      source: cropland2019.source,
    });
  }
  if (worldCereal2021) {
    out.push({
      label: t('sat_worldcereal_label', { defaultValue: 'WorldCereal 2021' }),
      text: t('sat_worldcereal_text', { defaultValue: 'Seasonal crops: {crops}. Maize, main season: {maize}.', crops: yesNo(t, worldCereal2021.temporaryCrops), maize: yesNo(t, worldCereal2021.maizeMainSeason) }),
      source: worldCereal2021.source,
    });
  }
  return out;
}

/** What free satellite data says about the field, each fact with its source and date. */
export const FieldSatellitePanel: React.FC<{ fieldId: string; hasLocation: boolean }> = ({ fieldId, hasLocation }) => {
  const { t } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ['field-satellite', fieldId],
    queryFn: () => fieldRecordsService.satellite(fieldId),
    enabled: hasLocation,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const muted = 'py-6 text-sm text-slate-600 dark:text-theme-text-secondary';

  if (!hasLocation) {
    return <p className={muted}>{t('sat_needs_location', { defaultValue: 'Add the field’s location, or map its boundary, to see what satellites record there.' })}</p>;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-10" role="status">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" aria-label={t('loading', { defaultValue: 'Loading' })} />
      </div>
    );
  }
  if (error || !data) {
    return <p className={muted}>{getApiErrorMessage(error, t('sat_unavailable', { defaultValue: 'Digital Earth Africa could not be reached or has no data here. Try again later.' }))}</p>;
  }

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.08]">
        {facts(t, data).map(fact => (
          <div key={fact.label} className="py-3 grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{fact.label}</dt>
            <dd className="text-sm text-slate-700 dark:text-theme-text-secondary">
              {fact.text}
              <span className="block text-xs text-slate-500 dark:text-theme-text-muted">{fact.source}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500 dark:text-theme-text-muted">
        {t('sat_scale_note', { defaultValue: 'Greenness and flood history come from 30 m satellite cells, rain from 5 km cells. Check the field before advising the farmer.' })}
      </p>
    </div>
  );
};
