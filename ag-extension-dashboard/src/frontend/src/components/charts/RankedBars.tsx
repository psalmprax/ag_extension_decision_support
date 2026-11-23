import React from 'react';
import { formatNumber } from './chartFormat';
import { seriesColor } from './chartConfig';

export interface RankedBarRow {
  label: string;
  value: number;
  /** Bar colour; defaults to series slot 1. Status rows pass a status colour. */
  color?: string;
  /** Extra text after the value, such as a share: "38%". */
  detail?: string;
}

interface RankedBarsProps {
  rows: RankedBarRow[];
  /** Label for the list as a whole, for screen readers. */
  label: string;
  formatValue?: (value: number, row: RankedBarRow) => string;
  /** Largest first (default). Off for rows in a fixed order, such as task states. */
  sort?: boolean;
}

/**
 * Labelled horizontal bars with the value printed on every row, for counts by category.
 * Used instead of donuts and single-bar charts: lengths compare at a glance, and no value
 * hides behind a hover.
 */
export const RankedBars: React.FC<RankedBarsProps> = ({ rows, label, formatValue = value => formatNumber(value, 1), sort = true }) => {
  const ordered = sort ? [...rows].sort((a, b) => b.value - a.value) : rows;
  const max = Math.max(1, ...ordered.map(row => row.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {ordered.map(row => {
        const share = row.value > 0 ? Math.max(1, (row.value / max) * 100) : 0;
        return (
          <li key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-slate-700 dark:text-theme-text-secondary">{row.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium text-slate-900 dark:text-theme-text-primary">{formatValue(row.value, row)}</span>
                {row.detail && <span className="ms-1.5 text-slate-600 dark:text-theme-text-muted">{row.detail}</span>}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.06]" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${share}%`, background: row.color ?? seriesColor(0) }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
