import React from 'react';
import { appLocale } from '@/lib/appLocale';
import { StatCardProps } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { StatTile } from '@/components/ui/StatTile';

/**
 * A dashboard figure. The month-on-month change shows only when there is a
 * baseline: the API reports 0 when last month had nothing to compare against,
 * so a zero change is "unknown" here rather than "flat".
 */
export const StatCard = ({ title, value, change, icon }: StatCardProps) => {
  const { t } = useLanguage();
  const hasChange = typeof change === 'number' && Number.isFinite(change) && change !== 0;
  const empty = value === undefined || value === null || value === '';
  const shown = empty ? '\u2014' : typeof value === 'number' ? value.toLocaleString(appLocale()) : value;

  return (
    <StatTile
      label={title}
      icon={icon}
      value={shown}
      note={
        hasChange ? (
          <>
            <span className={`tabular-nums ${(change as number) > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {(change as number) > 0 ? '+' : ''}
              {change}%
            </span>{' '}
            {t('stat_vs_last_month', { defaultValue: 'vs last month' })}
          </>
        ) : undefined
      }
    />
  );
};
