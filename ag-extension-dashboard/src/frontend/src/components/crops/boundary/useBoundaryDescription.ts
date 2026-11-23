import { useLanguage } from '@/lib/LanguageContext';
import { useUnits } from '@/hooks/useUnits';
import { formatNumber } from '@/components/charts/chartFormat';
import { summarizeBoundary, type FieldBoundary } from './boundaryModel';

/** How a field's area was measured: from a walked or drawn boundary, and how far off it could be. */
export function useBoundaryDescription(boundary: FieldBoundary) {
  const { t } = useLanguage();
  const units = useUnits();
  const summary = summarizeBoundary(boundary);
  const how =
    boundary.method === 'walked'
      ? boundary.accuracyM
        ? t('boundary_walked_with_error', { defaultValue: 'Walked with GPS, typical error ±{metres} m', metres: formatNumber(boundary.accuracyM, 0) })
        : t('boundary_walked', { defaultValue: 'Walked with GPS' })
      : t('boundary_drawn', { defaultValue: 'Drawn on the satellite map' });
  const margin = summary.uncertaintyHa !== null
    ? t('boundary_margin', { defaultValue: 'could be off by up to about {area}', area: units.area(summary.uncertaintyHa, 2) })
    : null;
  return { summary, area: units.area(summary.metrics.hectares, 2), how, margin };
}
