import React from 'react';
import { formatNumber } from './chartFormat';

export type TooltipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

/** Formats one value; gets the hovered row too, for values that come with their own text. */
export type TooltipValueFormatter = (
  value: number | string,
  name: string,
  row: Record<string, unknown> | undefined
) => string;

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => React.ReactNode;
  valueFormatter?: TooltipValueFormatter;
}

const defaultValue: TooltipValueFormatter = value => (typeof value === 'number' ? formatNumber(value) : String(value));

/**
 * Hover card shared by every chart: an opaque panel in both modes, the hovered label, then one
 * line per series with its colour, name and value. Units come from the chart's `valueFormatter`.
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, labelFormatter, valueFormatter = defaultValue }) => {
  if (!active || !payload || payload.length === 0) return null;
  const heading = label === undefined || label === null || label === '' ? null : labelFormatter ? labelFormatter(label) : label;

  return (
    <div className="min-w-[140px] rounded-md border border-slate-900/[0.1] dark:border-white/[0.12] bg-white dark:bg-theme-bg-tertiary px-3 py-2 shadow-sm">
      {heading !== null && (
        <p className="mb-1 text-xs font-medium text-slate-900 dark:text-theme-text-primary">{heading}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const name = String(entry.name ?? entry.dataKey ?? '');
          const color = entry.color ?? (entry.payload?.fill as string | undefined) ?? 'var(--color-series-1)';
          return (
            <div key={`${name}-${index}`} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-theme-text-secondary">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                {name}
              </span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-theme-text-primary">
                {valueFormatter(entry.value ?? '', name, entry.payload)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChartTooltip;
