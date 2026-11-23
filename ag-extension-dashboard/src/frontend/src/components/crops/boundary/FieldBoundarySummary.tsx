import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { BoundaryOutline } from './BoundaryOutline';
import { useBoundaryDescription } from './useBoundaryDescription';
import type { FieldBoundary } from './boundaryModel';

/** The boundary inside the field form: its shape, measured area and how it was mapped. */
export const FieldBoundarySummary: React.FC<{ boundary: FieldBoundary; actions: React.ReactNode }> = ({ boundary, actions }) => {
  const { t } = useLanguage();
  const { area, how, margin } = useBoundaryDescription(boundary);
  return (
    <div className="flex gap-3 rounded-md border border-slate-900/[0.08] dark:border-white/[0.08] p-3">
      <BoundaryOutline points={boundary.points} label={t('boundary_outline_label', { defaultValue: 'Shape of the field' })} />
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-slate-900 dark:text-theme-text-primary">
          <span className="font-medium tabular-nums">{area}</span>{' '}
          {t('boundary_measured_from', { defaultValue: 'measured from the boundary' })}
        </p>
        <p className="text-xs text-slate-600 dark:text-theme-text-muted">{margin ? `${how}; ${margin}.` : `${how}.`}</p>
        <div className="flex flex-wrap gap-2 pt-1">{actions}</div>
      </div>
    </div>
  );
};
