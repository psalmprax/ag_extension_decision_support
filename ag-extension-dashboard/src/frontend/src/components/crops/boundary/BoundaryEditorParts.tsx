import React from 'react';
import type { BoundaryProblem } from '@ag-extension/shared/api';
import { useLanguage } from '@/lib/LanguageContext';
import { useUnits } from '@/hooks/useUnits';
import { formatNumber } from '@/components/charts/chartFormat';
import { WALK_MAX_ACCURACY_M, type BoundarySummary, type FieldBoundary } from './boundaryModel';
import type { GpsState } from './useBoundaryDraft';

const PROBLEM_TEXT: Record<BoundaryProblem, [string, string]> = {
  too_few_points: ['boundary_problem_too_few', 'Add at least three corners.'],
  crosses_itself: ['boundary_problem_crosses', 'The edge crosses itself. Undo the last corners or clear and start again.'],
  too_small: ['boundary_problem_too_small', 'The shape encloses almost no area.'],
  too_large: ['boundary_problem_too_large', 'The shape is far larger than one field.'],
};

const GPS_TEXT: Partial<Record<GpsState, [string, string]>> = {
  denied: ['boundary_gps_denied', 'Location access is off for this site. Allow it in the browser settings, or tap the corners on the map instead.'],
  unsupported: ['boundary_gps_unsupported', 'This browser cannot share its location. Tap the corners on the map instead.'],
};

/** Why walking is not adding points: no location access, no fix, or fixes too rough to use. */
export const GpsMessage: React.FC<{ gps: GpsState; signalLost: boolean; skipped: number | null }> = ({ gps, signalLost, skipped }) => {
  const { t } = useLanguage();
  const problem = GPS_TEXT[gps];
  const text = problem
    ? t(problem[0], { defaultValue: problem[1] })
    : signalLost
      ? t('boundary_gps_unavailable', { defaultValue: 'No GPS fix right now. Keep walking in the open; points are added again once the fix returns.' })
      : skipped !== null
      ? t('boundary_fix_skipped', { defaultValue: 'GPS is only accurate to ±{metres} m here; waiting for a better fix (±{limit} m or better).', metres: Math.round(skipped), limit: WALK_MAX_ACCURACY_M })
      : null;
  return text ? <p className="text-sm text-amber-800 dark:text-amber-200" role="status">{text}</p> : null;
};

/** Area, edge length, point count and GPS error of the shape so far. */
export const BoundaryStats: React.FC<{ boundary: FieldBoundary; summary: BoundarySummary; pointCount: number }> = ({ boundary, summary, pointCount }) => {
  const { t } = useLanguage();
  const units = useUnits();
  const stats: Array<[string, string]> = [
    [t('boundary_area', { defaultValue: 'Area' }), summary.problem ? '—' : units.area(summary.metrics.hectares, 2)],
    [t('boundary_perimeter', { defaultValue: 'Edge length' }), `${formatNumber(summary.metrics.perimeterM, 0)} m`],
    [t('boundary_points', { defaultValue: 'Points' }), formatNumber(pointCount, 0)],
    [t('boundary_gps_error', { defaultValue: 'Typical GPS error' }), boundary.accuracyM ? `±${formatNumber(boundary.accuracyM, 0)} m` : '—'],
  ];
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-md border border-slate-900/[0.08] dark:border-white/[0.08] p-3 text-sm">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-slate-500 dark:text-theme-text-muted">{label}</dt>
          <dd className="mt-0.5 font-medium text-slate-900 dark:text-theme-text-primary tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

/** What is wrong with the shape, or how far off its area could be. */
export const BoundaryNote: React.FC<{ summary: BoundarySummary; boundary: FieldBoundary }> = ({ summary, boundary }) => {
  const { t } = useLanguage();
  const units = useUnits();
  let text: string | null = null;
  if (summary.problem && boundary.points.length > 0) text = t(PROBLEM_TEXT[summary.problem][0], { defaultValue: PROBLEM_TEXT[summary.problem][1] });
  else if (summary.uncertaintyHa !== null) text = t('boundary_uncertainty', { defaultValue: 'From the GPS error along the edge, the area could be off by up to about {area}.', area: units.area(summary.uncertaintyHa, 2) });
  else if (boundary.method === 'drawn') text = t('boundary_drawn_note', { defaultValue: 'Drawn on satellite imagery: how close it is depends on how well the imagery lines up with the ground.' });
  return text ? <p className="text-xs text-slate-600 dark:text-theme-text-muted">{text}</p> : null;
};
