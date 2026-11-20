import React from 'react';
import { StatCardProps } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';

const EMPTY_VALUE = '\u2014';

/**
 * One headline figure. The month-on-month change shows only when there is a
 * baseline: the API reports 0 when last month had nothing to compare against,
 * so a zero change is "unknown" here rather than "flat".
 */
export const StatCard = ({ title, value, change, icon: Icon, cardClass, headingClass, dataClass }: StatCardProps) => {
  const { t } = useLanguage();
  const hasChange = typeof change === 'number' && Number.isFinite(change) && change !== 0;
  const shown = value === undefined || value === null || value === '' ? EMPTY_VALUE : typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon className="w-4 h-4" aria-hidden="true" />
        <h3 className={`text-sm ${headingClass ?? ''} !font-normal !text-slate-600 dark:!text-slate-300`}>{title}</h3>
      </div>
      <div className={`mt-3 text-3xl leading-none ${dataClass ?? ''}`}>{shown}</div>
      {hasChange && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span className={`font-mono tabular-nums ${(change as number) > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {(change as number) > 0 ? '+' : ''}
            {change}%
          </span>{' '}
          {t('stat_vs_last_month', { defaultValue: 'vs last month' })}
        </p>
      )}
    </div>
  );
};
